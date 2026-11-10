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
import { CreateTagDto } from '../../dto/catalog/tag/create-tag.dto';
import { TagResponseDto } from '../../dto/catalog/tag/tag-response.dto';
import { UpdateTagDto } from '../../dto/catalog/tag/update-tag.dto';
import { ProductTag } from '../../entities/product-tag.entity';
import { Tag } from '../../entities/tag.entity';

/**
 * Maximum length of a tag slug (matches the column length).
 */
const SLUG_MAX_LENGTH = 70;

/**
 * Tags service (admin operations).
 *
 * Name uniqueness is case-insensitive (citext column). A disabled tag is
 * hidden from filters and display only; it never affects product visibility.
 */
@Injectable()
export class TagService {
  /**
   * Injects the repositories used by this service.
   *
   * @param tagsRepository TypeORM repository for Tag entities.
   * @param productTagsRepository TypeORM repository used to check usage before deleting.
   */
  constructor(
    @InjectRepository(Tag)
    private readonly tagsRepository: Repository<Tag>,
    @InjectRepository(ProductTag)
    private readonly productTagsRepository: Repository<ProductTag>,
  ) {}

  /**
   * Converts a Tag entity into the admin response object.
   *
   * @param tag Tag entity.
   * @returns Admin response data.
   */
  private toResponseDto(tag: Tag): TagResponseDto {
    return {
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      isActive: tag.isActive,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt,
    };
  }

  /**
   * Finds a tag entity by its identifier.
   *
   * @param id Tag UUID.
   * @returns The matching tag entity.
   * @throws NotFoundException If the tag does not exist.
   */
  private async findEntity(id: string): Promise<Tag> {
    const tag = await this.tagsRepository.findOne({ where: { id } });

    if (!tag) {
      throw new NotFoundException(`Tag with ID ${id} was not found.`);
    }

    return tag;
  }

  /**
   * Ensures the name and slug are not used by another tag.
   * The database constraints remain the last line of defense for races.
   *
   * @param fields Name and/or slug to check.
   * @param excludeId Tag that is allowed to keep its own values.
   * @throws ConflictException If another tag uses the name or the slug.
   */
  private async assertAvailable(
    fields: { name?: string; slug?: string },
    excludeId?: string,
  ): Promise<void> {
    if (fields.name !== undefined) {
      const existing = await this.tagsRepository.findOne({
        where: { name: fields.name },
        select: { id: true },
      });

      if (existing && existing.id !== excludeId) {
        throw new ConflictException(
          `A tag named "${fields.name}" already exists (names are case-insensitive).`,
        );
      }
    }

    if (fields.slug !== undefined) {
      const existing = await this.tagsRepository.findOne({
        where: { slug: fields.slug },
        select: { id: true },
      });

      if (existing && existing.id !== excludeId) {
        throw new ConflictException(
          `A tag with the slug "${fields.slug}" already exists.`,
        );
      }
    }
  }

  /**
   * Creates a tag.
   *
   * @param dto Validated creation data.
   * @returns The created tag.
   * @throws UnprocessableEntityException If the slug cannot be generated.
   * @throws ConflictException If the name or the slug is already in use.
   */
  async create(dto: CreateTagDto): Promise<TagResponseDto> {
    const slug = dto.slug ?? slugify(dto.name, SLUG_MAX_LENGTH);

    if (!slug) {
      throw new UnprocessableEntityException(
        'A slug could not be generated from the name. Please provide a slug.',
      );
    }

    await this.assertAvailable({ name: dto.name, slug });

    const tag = this.tagsRepository.create({
      name: dto.name,
      slug,
      isActive: dto.isActive ?? true,
    });

    return this.toResponseDto(await this.tagsRepository.save(tag));
  }

  /**
   * Lists tags with pagination, name search and active filter.
   *
   * @param query Validated list query.
   * @returns A page of tags.
   */
  async findAll(
    query: CatalogListQueryDto,
  ): Promise<PaginatedResponseDto<TagResponseDto>> {
    const qb = this.tagsRepository.createQueryBuilder('tag');

    if (query.q) {
      qb.andWhere('tag.name ILIKE :q', { q: `%${escapeLike(query.q)}%` });
    }

    if (query.isActive !== undefined) {
      qb.andWhere('tag.isActive = :isActive', { isActive: query.isActive });
    }

    const [tags, total] = await qb
      .orderBy('tag.name', 'ASC')
      .addOrderBy('tag.id', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();

    return buildPaginated(
      tags.map((tag) => this.toResponseDto(tag)),
      total,
      query.page,
      query.limit,
    );
  }

  /**
   * Retrieves a tag by its identifier.
   *
   * @param id Tag UUID.
   * @returns The matching tag.
   * @throws NotFoundException If the tag does not exist.
   */
  async findOne(id: string): Promise<TagResponseDto> {
    return this.toResponseDto(await this.findEntity(id));
  }

  /**
   * Updates a tag. No tag field is nullable, so null is always rejected.
   *
   * @param id Tag UUID.
   * @param dto Fields to update.
   * @returns The updated tag.
   * @throws BadRequestException If any field is null.
   * @throws NotFoundException If the tag does not exist.
   * @throws ConflictException If the name or the slug is already in use.
   */
  async update(id: string, dto: UpdateTagDto): Promise<TagResponseDto> {
    assertNoNullFields(dto);

    const tag = await this.findEntity(id);

    await this.assertAvailable({ name: dto.name, slug: dto.slug }, id);

    if (dto.name !== undefined) tag.name = dto.name;
    if (dto.slug !== undefined) tag.slug = dto.slug;
    if (dto.isActive !== undefined) tag.isActive = dto.isActive;

    return this.toResponseDto(await this.tagsRepository.save(tag));
  }

  /**
   * Deletes a tag permanently. Allowed only when no product uses it.
   * Disabling is the recommended option.
   *
   * @param id Tag UUID.
   * @throws NotFoundException If the tag does not exist.
   * @throws ConflictException If the tag is linked to products.
   */
  async remove(id: string): Promise<void> {
    const tag = await this.findEntity(id);

    const links = await this.productTagsRepository.count({
      where: { tagId: id },
    });

    if (links > 0) {
      throw new ConflictException(
        'This tag is used by products. Disable it instead of deleting it.',
      );
    }

    await this.tagsRepository.remove(tag);
  }
}