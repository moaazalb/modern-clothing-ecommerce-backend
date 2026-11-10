import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';

import {
  buildPaginated,
  PaginatedResponseDto,
} from '../../../common/dto/paginated-response.dto';
import { assertNoNullFields } from '../../../common/utils/assert-no-null-fields.util';
import { escapeLike } from '../../../common/utils/escape-like.util';
import { slugify } from '../../../common/utils/slug.util';
import {
  CATEGORY_MAX_DEPTH,
  CATEGORY_TREE_LOCK_KEY,
} from '../../constants/product.constants';
import { CatalogListQueryDto } from '../../dto/catalog/catalog-list-query.dto';
import { CategoryResponseDto } from '../../dto/catalog/category/category-response.dto';
import { CreateCategoryDto } from '../../dto/catalog/category/create-category.dto';
import { UpdateCategoryDto } from '../../dto/catalog/category/update-category.dto';
import { Category } from '../../entities/category.entity';
import { Product } from '../../entities/product.entity';

/**
 * Maximum length of a category slug (matches the column length).
 */
const SLUG_MAX_LENGTH = 120;

/**
 * Categories service (admin operations).
 *
 * Every operation that reads or changes the shape of the tree takes a
 * transaction-level advisory lock, so two concurrent moves can never create
 * a cycle or exceed the maximum depth. Tree changes are rare, so the lock
 * has no practical cost.
 *
 * Deactivating a category never changes data: its products and descendants
 * are hidden by the visibility query, not by updating rows.
 */
@Injectable()
export class CategoryService {
  /**
   * Injects the repository and the data source used for transactions.
   *
   * @param categoriesRepository TypeORM repository for Category entities.
   * @param dataSource TypeORM data source used to open transactions.
   */
  constructor(
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Converts a Category entity into the admin response object.
   *
   * @param category Category entity.
   * @returns Admin response data.
   */
  private toResponseDto(category: Category): CategoryResponseDto {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      parentId: category.parentId,
      isActive: category.isActive,
      sortOrder: category.sortOrder,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }

  /**
   * Finds a category entity by its identifier.
   *
   * @param id Category UUID.
   * @returns The matching category entity.
   * @throws NotFoundException If the category does not exist.
   */
  private async findEntity(id: string): Promise<Category> {
    const category = await this.categoriesRepository.findOne({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} was not found.`);
    }

    return category;
  }

  /**
   * Takes the transaction-level advisory lock of the category tree.
   * It is released automatically when the transaction ends.
   *
   * @param manager Entity manager of the running transaction.
   */
  private async lockTree(manager: EntityManager): Promise<void> {
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1::text))', [
      CATEGORY_TREE_LOCK_KEY,
    ]);
  }

  /**
   * Returns the identifiers of a category and all its ancestors.
   * The number of returned ids equals the category's level (root = 1).
   *
   * @param manager Entity manager of the running transaction.
   * @param categoryId Category UUID.
   * @returns Identifiers of the category and its ancestors.
   */
  private async getAncestorChain(
    manager: EntityManager,
    categoryId: string,
  ): Promise<string[]> {
    const rows: { id: string }[] = await manager.query(
      `WITH RECURSIVE "chain" AS (
         SELECT "id", "parentId", 1 AS "level"
         FROM "categories" WHERE "id" = $1
         UNION ALL
         SELECT c."id", c."parentId", ch."level" + 1
         FROM "categories" c
         JOIN "chain" ch ON c."id" = ch."parentId"
         WHERE ch."level" < 50
       )
       SELECT "id" FROM "chain"`,
      [categoryId],
    );

    return rows.map((row) => row.id);
  }

  /**
   * Returns the height of the subtree rooted at a category
   * (1 for a category without children).
   *
   * @param manager Entity manager of the running transaction.
   * @param categoryId Category UUID.
   * @returns Number of levels in the subtree, including the category itself.
   */
  private async getSubtreeHeight(
    manager: EntityManager,
    categoryId: string,
  ): Promise<number> {
    const rows: { height: number }[] = await manager.query(
      `WITH RECURSIVE "subtree" AS (
         SELECT "id", 1 AS "level"
         FROM "categories" WHERE "id" = $1
         UNION ALL
         SELECT c."id", s."level" + 1
         FROM "categories" c
         JOIN "subtree" s ON c."parentId" = s."id"
         WHERE s."level" < 50
       )
       SELECT COALESCE(MAX("level"), 1) AS "height" FROM "subtree"`,
      [categoryId],
    );

    return Number(rows[0]?.height ?? 1);
  }

  /**
   * Validates that a category can be placed under a parent.
   * Must be called while holding the tree lock.
   *
   * @param manager Entity manager of the running transaction.
   * @param parentId Identifier of the intended parent.
   * @param subtreeHeight Height of the subtree being placed (1 for a new category).
   * @param movingId Identifier of the category being moved (omit when creating).
   * @throws UnprocessableEntityException If the parent is missing, inactive, or the depth limit is exceeded.
   * @throws ConflictException If the move would create a cycle.
   */
  private async assertParentAllowed(
    manager: EntityManager,
    parentId: string,
    subtreeHeight: number,
    movingId?: string,
  ): Promise<void> {
    const parent = await manager.findOne(Category, {
      where: { id: parentId },
    });

    if (!parent) {
      throw new UnprocessableEntityException(
        'The parent category was not found.',
      );
    }

    const chain = await this.getAncestorChain(manager, parentId);

    if (movingId && chain.includes(movingId)) {
      throw new ConflictException(
        'A category cannot be moved under itself or one of its descendants.',
      );
    }

    if (!parent.isActive) {
      throw new UnprocessableEntityException(
        'A category cannot be placed under an inactive parent.',
      );
    }

    if (chain.length + subtreeHeight > CATEGORY_MAX_DEPTH) {
      throw new UnprocessableEntityException(
        `The category tree cannot be deeper than ${CATEGORY_MAX_DEPTH} levels.`,
      );
    }
  }

  /**
   * Ensures a slug is not used by another category.
   *
   * @param manager Entity manager of the running transaction.
   * @param slug Slug to check.
   * @param excludeId Category that is allowed to keep the slug.
   * @throws ConflictException If another category already uses the slug.
   */
  private async assertSlugAvailable(
    manager: EntityManager,
    slug: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await manager.findOne(Category, {
      where: { slug },
      select: { id: true },
    });

    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        `A category with the slug "${slug}" already exists.`,
      );
    }
  }

  /**
   * Creates a category.
   *
   * @param dto Validated creation data.
   * @returns The created category.
   * @throws UnprocessableEntityException If the slug cannot be generated, or the parent is invalid.
   * @throws ConflictException If the slug is already in use.
   */
  async create(dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    const slug = dto.slug ?? slugify(dto.name, SLUG_MAX_LENGTH);

    if (!slug) {
      throw new UnprocessableEntityException(
        'A slug could not be generated from the name. Please provide a slug.',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      if (dto.parentId) {
        await this.lockTree(manager);
        await this.assertParentAllowed(manager, dto.parentId, 1);
      }

      await this.assertSlugAvailable(manager, slug);

      const category = manager.create(Category, {
        name: dto.name,
        slug,
        description: dto.description ?? null,
        parentId: dto.parentId ?? null,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      });

      return this.toResponseDto(await manager.save(category));
    });
  }

  /**
   * Lists categories with pagination, name search and active filter.
   *
   * @param query Validated list query.
   * @returns A page of categories.
   */
  async findAll(
    query: CatalogListQueryDto,
  ): Promise<PaginatedResponseDto<CategoryResponseDto>> {
    const qb = this.categoriesRepository.createQueryBuilder('category');

    if (query.q) {
      qb.andWhere('category.name ILIKE :q', {
        q: `%${escapeLike(query.q)}%`,
      });
    }

    if (query.isActive !== undefined) {
      qb.andWhere('category.isActive = :isActive', {
        isActive: query.isActive,
      });
    }

    const [categories, total] = await qb
      .orderBy('category.sortOrder', 'ASC')
      .addOrderBy('category.name', 'ASC')
      .addOrderBy('category.id', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();

    return buildPaginated(
      categories.map((category) => this.toResponseDto(category)),
      total,
      query.page,
      query.limit,
    );
  }

  /**
   * Retrieves a category by its identifier.
   *
   * @param id Category UUID.
   * @returns The matching category.
   * @throws NotFoundException If the category does not exist.
   */
  async findOne(id: string): Promise<CategoryResponseDto> {
    return this.toResponseDto(await this.findEntity(id));
  }

  /**
   * Updates a category, including moving it to another parent.
   *
   * The slug never changes unless it is sent explicitly. Null is accepted
   * only for description and parentId (null parentId makes it a root).
   *
   * @param id Category UUID.
   * @param dto Fields to update.
   * @returns The updated category.
   * @throws BadRequestException If a non-nullable field is null.
   * @throws NotFoundException If the category does not exist.
   * @throws ConflictException If the slug is taken or the move would create a cycle.
   * @throws UnprocessableEntityException If the new parent is invalid.
   */
  async update(
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    assertNoNullFields(dto, ['description', 'parentId']);

    return this.dataSource.transaction(async (manager) => {
      if (dto.parentId !== undefined) {
        await this.lockTree(manager);
      }

      const category = await manager.findOne(Category, { where: { id } });

      if (!category) {
        throw new NotFoundException(`Category with ID ${id} was not found.`);
      }

      if (dto.parentId !== undefined && dto.parentId !== category.parentId) {
        if (dto.parentId !== null) {
          const height = await this.getSubtreeHeight(manager, id);
          await this.assertParentAllowed(manager, dto.parentId, height, id);
        }

        category.parentId = dto.parentId;
      }

      if (dto.slug !== undefined && dto.slug !== category.slug) {
        await this.assertSlugAvailable(manager, dto.slug, id);
        category.slug = dto.slug;
      }

      if (dto.name !== undefined) category.name = dto.name;
      if (dto.description !== undefined) category.description = dto.description;
      if (dto.isActive !== undefined) category.isActive = dto.isActive;
      if (dto.sortOrder !== undefined) category.sortOrder = dto.sortOrder;

      return this.toResponseDto(await manager.save(category));
    });
  }

  /**
   * Deletes a category permanently.
   *
   * Allowed only when it has no child categories and no products
   * (soft-deleted products count). Disabling is the recommended option.
   *
   * @param id Category UUID.
   * @throws NotFoundException If the category does not exist.
   * @throws ConflictException If the category has children or products.
   */
  async remove(id: string): Promise<void> {
    const category = await this.findEntity(id);

    const children = await this.categoriesRepository.count({
      where: { parentId: id },
    });

    if (children > 0) {
      throw new ConflictException(
        'This category has child categories. Move or delete them first, or disable the category instead.',
      );
    }

    const products = await this.dataSource.manager.count(Product, {
      where: { categoryId: id },
      withDeleted: true,
    });

    if (products > 0) {
      throw new ConflictException(
        'This category is used by products (including deleted ones). Disable it instead of deleting it.',
      );
    }

    await this.categoriesRepository.remove(category);
  }
}