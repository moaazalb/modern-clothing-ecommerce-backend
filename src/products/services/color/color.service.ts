import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  buildPaginated,
  PaginatedResponseDto,
} from '../../../common/dto/paginated-response.dto';
import { assertNoNullFields } from '../../../common/utils/assert-no-null-fields.util';
import { escapeLike } from '../../../common/utils/escape-like.util';
import { slugify } from '../../../common/utils/slug.util';
import { CatalogListQueryDto } from '../../dto/catalog/catalog-list-query.dto';
import { ColorResponseDto } from '../../dto/catalog/color/color-response.dto';
import { CreateColorDto } from '../../dto/catalog/color/create-color.dto';
import { UpdateColorDto } from '../../dto/catalog/color/update-color.dto';
import { Color } from '../../entities/color.entity';
import { ProductColor } from '../../entities/product-color.entity';

/**
 * Maximum length of a color slug (matches the column length).
 */
const SLUG_MAX_LENGTH = 70;

/**
 * Colors service (admin operations).
 *
 * Name uniqueness is case-insensitive (citext column) and the hex code is
 * already normalized to uppercase by the DTO. Disabling a color never
 * changes products, variants or images that use it.
 */
@Injectable()
export class ColorService {
  /**
   * Injects the repositories used by this service.
   *
   * @param colorsRepository TypeORM repository for Color entities.
   * @param productColorsRepository TypeORM repository used to check usage before deleting.
   */
  constructor(
    @InjectRepository(Color)
    private readonly colorsRepository: Repository<Color>,
    @InjectRepository(ProductColor)
    private readonly productColorsRepository: Repository<ProductColor>,
  ) {}

  /**
   * Converts a Color entity into the admin response object.
   *
   * @param color Color entity.
   * @returns Admin response data.
   */
  private toResponseDto(color: Color): ColorResponseDto {
    return {
      id: color.id,
      name: color.name,
      slug: color.slug,
      hexCode: color.hexCode,
      isActive: color.isActive,
      createdAt: color.createdAt,
      updatedAt: color.updatedAt,
    };
  }

  /**
   * Finds a color entity by its identifier.
   *
   * @param id Color UUID.
   * @returns The matching color entity.
   * @throws NotFoundException If the color does not exist.
   */
  private async findEntity(id: string): Promise<Color> {
    const color = await this.colorsRepository.findOne({ where: { id } });

    if (!color) {
      throw new NotFoundException(`Color with ID ${id} was not found.`);
    }

    return color;
  }

  /**
   * Ensures the name and slug are not used by another color.
   * The database constraints remain the last line of defense for races.
   *
   * @param fields Name and/or slug to check.
   * @param excludeId Color that is allowed to keep its own values.
   * @throws ConflictException If another color uses the name or the slug.
   */
  private async assertAvailable(
    fields: { name?: string; slug?: string },
    excludeId?: string,
  ): Promise<void> {
    if (fields.name !== undefined) {
      const existing = await this.colorsRepository.findOne({
        where: { name: fields.name },
        select: { id: true },
      });

      if (existing && existing.id !== excludeId) {
        throw new ConflictException(
          `A color named "${fields.name}" already exists (names are case-insensitive).`,
        );
      }
    }

    if (fields.slug !== undefined) {
      const existing = await this.colorsRepository.findOne({
        where: { slug: fields.slug },
        select: { id: true },
      });

      if (existing && existing.id !== excludeId) {
        throw new ConflictException(
          `A color with the slug "${fields.slug}" already exists.`,
        );
      }
    }
  }

  /**
   * Creates a color.
   *
   * @param dto Validated creation data.
   * @returns The created color.
   * @throws UnprocessableEntityException If the slug cannot be generated.
   * @throws ConflictException If the name or the slug is already in use.
   */
  async create(dto: CreateColorDto): Promise<ColorResponseDto> {
    const slug = dto.slug ?? slugify(dto.name, SLUG_MAX_LENGTH);

    if (!slug) {
      throw new UnprocessableEntityException(
        'A slug could not be generated from the name. Please provide a slug.',
      );
    }

    await this.assertAvailable({ name: dto.name, slug });

    const color = this.colorsRepository.create({
      name: dto.name,
      slug,
      hexCode: dto.hexCode,
      isActive: dto.isActive ?? true,
    });

    return this.toResponseDto(await this.colorsRepository.save(color));
  }

  /**
   * Lists colors with pagination, name search and active filter.
   *
   * @param query Validated list query.
   * @returns A page of colors.
   */
  async findAll(
    query: CatalogListQueryDto,
  ): Promise<PaginatedResponseDto<ColorResponseDto>> {
    const qb = this.colorsRepository.createQueryBuilder('color');

    if (query.q) {
      qb.andWhere('color.name ILIKE :q', { q: `%${escapeLike(query.q)}%` });
    }

    if (query.isActive !== undefined) {
      qb.andWhere('color.isActive = :isActive', { isActive: query.isActive });
    }

    const [colors, total] = await qb
      .orderBy('color.name', 'ASC')
      .addOrderBy('color.id', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();

    return buildPaginated(
      colors.map((color) => this.toResponseDto(color)),
      total,
      query.page,
      query.limit,
    );
  }

  /**
   * Retrieves a color by its identifier.
   *
   * @param id Color UUID.
   * @returns The matching color.
   * @throws NotFoundException If the color does not exist.
   */
  async findOne(id: string): Promise<ColorResponseDto> {
    return this.toResponseDto(await this.findEntity(id));
  }

  /**
   * Updates a color. No color field is nullable, so null is always rejected.
   *
   * @param id Color UUID.
   * @param dto Fields to update.
   * @returns The updated color.
   * @throws BadRequestException If any field is null.
   * @throws NotFoundException If the color does not exist.
   * @throws ConflictException If the name or the slug is already in use.
   */
  async update(id: string, dto: UpdateColorDto): Promise<ColorResponseDto> {
    assertNoNullFields(dto);

    const color = await this.findEntity(id);

    await this.assertAvailable({ name: dto.name, slug: dto.slug }, id);

    if (dto.name !== undefined) color.name = dto.name;
    if (dto.slug !== undefined) color.slug = dto.slug;
    if (dto.hexCode !== undefined) color.hexCode = dto.hexCode;
    if (dto.isActive !== undefined) color.isActive = dto.isActive;

    return this.toResponseDto(await this.colorsRepository.save(color));
  }

  /**
   * Deletes a color permanently. Allowed only when no product uses it.
   * Disabling is the recommended option.
   *
   * @param id Color UUID.
   * @throws NotFoundException If the color does not exist.
   * @throws ConflictException If the color is linked to products.
   */
  async remove(id: string): Promise<void> {
    const color = await this.findEntity(id);

    const links = await this.productColorsRepository.count({
      where: { colorId: id },
    });

    if (links > 0) {
      throw new ConflictException(
        'This color is used by products. Disable it instead of deleting it.',
      );
    }

    await this.colorsRepository.remove(color);
  }
}