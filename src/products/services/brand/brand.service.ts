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
import { BrandResponseDto } from '../../dto/catalog/brand/brand-response.dto';
import { CreateBrandDto } from '../../dto/catalog/brand/create-brand.dto';
import { UpdateBrandDto } from '../../dto/catalog/brand/update-brand.dto';
import { CatalogListQueryDto } from '../../dto/catalog/catalog-list-query.dto';
import { Brand } from '../../entities/brand.entity';
import { Product } from '../../entities/product.entity';

/**
 * Maximum length of a brand slug (matches the column length).
 */
const SLUG_MAX_LENGTH = 120;

/**
 * Brands service (admin operations).
 *
 * Name uniqueness is case-insensitive (citext column). The slug never
 * changes unless it is sent explicitly. Disabling a brand never changes
 * its products.
 */
@Injectable()
export class BrandService {
  /**
   * Injects the repositories used by this service.
   *
   * @param brandsRepository TypeORM repository for Brand entities.
   * @param productsRepository TypeORM repository used to check usage before deleting.
   */
  constructor(
    @InjectRepository(Brand)
    private readonly brandsRepository: Repository<Brand>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
  ) {}

  /**
   * Converts a Brand entity into the admin response object.
   *
   * @param brand Brand entity.
   * @returns Admin response data.
   */
  private toResponseDto(brand: Brand): BrandResponseDto {
    return {
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      description: brand.description,
      logoUrl: brand.logoUrl,
      websiteUrl: brand.websiteUrl,
      isActive: brand.isActive,
      createdAt: brand.createdAt,
      updatedAt: brand.updatedAt,
    };
  }

  /**
   * Finds a brand entity by its identifier.
   *
   * @param id Brand UUID.
   * @returns The matching brand entity.
   * @throws NotFoundException If the brand does not exist.
   */
  private async findEntity(id: string): Promise<Brand> {
    const brand = await this.brandsRepository.findOne({ where: { id } });

    if (!brand) {
      throw new NotFoundException(`Brand with ID ${id} was not found.`);
    }

    return brand;
  }

  /**
   * Ensures the name and slug are not used by another brand.
   * The database constraints remain the last line of defense for races.
   *
   * @param fields Name and/or slug to check.
   * @param excludeId Brand that is allowed to keep its own values.
   * @throws ConflictException If another brand uses the name or the slug.
   */
  private async assertAvailable(
    fields: { name?: string; slug?: string },
    excludeId?: string,
  ): Promise<void> {
    if (fields.name !== undefined) {
      const existing = await this.brandsRepository.findOne({
        where: { name: fields.name },
        select: { id: true },
      });

      if (existing && existing.id !== excludeId) {
        throw new ConflictException(
          `A brand named "${fields.name}" already exists (names are case-insensitive).`,
        );
      }
    }

    if (fields.slug !== undefined) {
      const existing = await this.brandsRepository.findOne({
        where: { slug: fields.slug },
        select: { id: true },
      });

      if (existing && existing.id !== excludeId) {
        throw new ConflictException(
          `A brand with the slug "${fields.slug}" already exists.`,
        );
      }
    }
  }

  /**
   * Creates a brand.
   *
   * @param dto Validated creation data.
   * @returns The created brand.
   * @throws UnprocessableEntityException If the slug cannot be generated.
   * @throws ConflictException If the name or the slug is already in use.
   */
  async create(dto: CreateBrandDto): Promise<BrandResponseDto> {
    const slug = dto.slug ?? slugify(dto.name, SLUG_MAX_LENGTH);

    if (!slug) {
      throw new UnprocessableEntityException(
        'A slug could not be generated from the name. Please provide a slug.',
      );
    }

    await this.assertAvailable({ name: dto.name, slug });

    const brand = this.brandsRepository.create({
      name: dto.name,
      slug,
      description: dto.description ?? null,
      logoUrl: dto.logoUrl ?? null,
      websiteUrl: dto.websiteUrl ?? null,
      isActive: dto.isActive ?? true,
    });

    return this.toResponseDto(await this.brandsRepository.save(brand));
  }

  /**
   * Lists brands with pagination, name search and active filter.
   *
   * @param query Validated list query.
   * @returns A page of brands.
   */
  async findAll(
    query: CatalogListQueryDto,
  ): Promise<PaginatedResponseDto<BrandResponseDto>> {
    const qb = this.brandsRepository.createQueryBuilder('brand');

    if (query.q) {
      qb.andWhere('brand.name ILIKE :q', { q: `%${escapeLike(query.q)}%` });
    }

    if (query.isActive !== undefined) {
      qb.andWhere('brand.isActive = :isActive', { isActive: query.isActive });
    }

    const [brands, total] = await qb
      .orderBy('brand.name', 'ASC')
      .addOrderBy('brand.id', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();

    return buildPaginated(
      brands.map((brand) => this.toResponseDto(brand)),
      total,
      query.page,
      query.limit,
    );
  }

  /**
   * Retrieves a brand by its identifier.
   *
   * @param id Brand UUID.
   * @returns The matching brand.
   * @throws NotFoundException If the brand does not exist.
   */
  async findOne(id: string): Promise<BrandResponseDto> {
    return this.toResponseDto(await this.findEntity(id));
  }

  /**
   * Updates a brand. Null is accepted only for description, logoUrl and websiteUrl.
   *
   * @param id Brand UUID.
   * @param dto Fields to update.
   * @returns The updated brand.
   * @throws BadRequestException If a non-nullable field is null.
   * @throws NotFoundException If the brand does not exist.
   * @throws ConflictException If the name or the slug is already in use.
   */
  async update(id: string, dto: UpdateBrandDto): Promise<BrandResponseDto> {
    assertNoNullFields(dto, ['description', 'logoUrl', 'websiteUrl']);

    const brand = await this.findEntity(id);

    await this.assertAvailable({ name: dto.name, slug: dto.slug }, id);

    if (dto.name !== undefined) brand.name = dto.name;
    if (dto.slug !== undefined) brand.slug = dto.slug;
    if (dto.description !== undefined) brand.description = dto.description;
    if (dto.logoUrl !== undefined) brand.logoUrl = dto.logoUrl;
    if (dto.websiteUrl !== undefined) brand.websiteUrl = dto.websiteUrl;
    if (dto.isActive !== undefined) brand.isActive = dto.isActive;

    return this.toResponseDto(await this.brandsRepository.save(brand));
  }

  /**
   * Deletes a brand permanently. Allowed only when no product uses it
   * (soft-deleted products count). Disabling is the recommended option.
   *
   * @param id Brand UUID.
   * @throws NotFoundException If the brand does not exist.
   * @throws ConflictException If the brand is used by products.
   */
  async remove(id: string): Promise<void> {
    const brand = await this.findEntity(id);

    const products = await this.productsRepository.count({
      where: { brandId: id },
      withDeleted: true,
    });

    if (products > 0) {
      throw new ConflictException(
        'This brand is used by products (including deleted ones). Disable it instead of deleting it.',
      );
    }

    await this.brandsRepository.remove(brand);
  }
}