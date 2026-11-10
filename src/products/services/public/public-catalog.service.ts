import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PublicBrandDto } from '../../dto/catalog/brand/public-brand.dto';
import { PublicCategoryTreeNodeDto } from '../../dto/catalog/category/public-category-tree-node.dto';
import { PublicColorDto } from '../../dto/catalog/color/public-color.dto';
import { PublicSizeDto } from '../../dto/catalog/size/public-size.dto';
import { PublicTagDto } from '../../dto/catalog/tag/public-tag.dto';
import { Brand } from '../../entities/brand.entity';
import { Category } from '../../entities/category.entity';
import { Color } from '../../entities/color.entity';
import { Size } from '../../entities/size.entity';
import { Tag } from '../../entities/tag.entity';
import { SizeType } from '../../enums/product.enum';

/**
 * Public catalog service (storefront reference data).
 *
 * Returns only active records and never exposes isActive or timestamps.
 * These lists feed the storefront filters and menus.
 */
@Injectable()
export class PublicCatalogService {
  /**
   * Injects the repositories used by this service.
   *
   * @param categoriesRepository TypeORM repository for Category entities.
   * @param brandsRepository TypeORM repository for Brand entities.
   * @param colorsRepository TypeORM repository for Color entities.
   * @param sizesRepository TypeORM repository for Size entities.
   * @param tagsRepository TypeORM repository for Tag entities.
   */
  constructor(
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
    @InjectRepository(Brand)
    private readonly brandsRepository: Repository<Brand>,
    @InjectRepository(Color)
    private readonly colorsRepository: Repository<Color>,
    @InjectRepository(Size)
    private readonly sizesRepository: Repository<Size>,
    @InjectRepository(Tag)
    private readonly tagsRepository: Repository<Tag>,
  ) {}

  /**
   * Builds the category tree of effectively active categories.
   *
   * A category appears only if it and all of its ancestors are active:
   * the tree is built from the active roots downwards, so the children of
   * an inactive category are never reached.
   *
   * @returns The root nodes with their nested children.
   */
  async getCategoryTree(): Promise<PublicCategoryTreeNodeDto[]> {
    const categories = await this.categoriesRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC', id: 'ASC' },
    });

    const byParent = new Map<string | null, Category[]>();

    for (const category of categories) {
      const siblings = byParent.get(category.parentId) ?? [];
      siblings.push(category);
      byParent.set(category.parentId, siblings);
    }

    const build = (parentId: string | null): PublicCategoryTreeNodeDto[] =>
      (byParent.get(parentId) ?? []).map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        children: build(category.id),
      }));

    return build(null);
  }

  /**
   * Lists the active brands.
   *
   * @returns Active brands ordered by name.
   */
  async getBrands(): Promise<PublicBrandDto[]> {
    const brands = await this.brandsRepository.find({
      where: { isActive: true },
      order: { name: 'ASC', id: 'ASC' },
    });

    return brands.map((brand) => ({
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      logoUrl: brand.logoUrl,
    }));
  }

  /**
   * Lists the active colors.
   *
   * @returns Active colors ordered by name.
   */
  async getColors(): Promise<PublicColorDto[]> {
    const colors = await this.colorsRepository.find({
      where: { isActive: true },
      order: { name: 'ASC', id: 'ASC' },
    });

    return colors.map((color) => ({
      id: color.id,
      name: color.name,
      slug: color.slug,
      hexCode: color.hexCode,
    }));
  }

  /**
   * Lists the active sizes, optionally for one sizing system.
   *
   * @param sizeType Sizing system to filter by. Omit for all.
   * @returns Active sizes ordered by system and display order.
   */
  async getSizes(sizeType?: SizeType): Promise<PublicSizeDto[]> {
    const sizes = await this.sizesRepository.find({
      where: sizeType ? { isActive: true, sizeType } : { isActive: true },
      order: { sizeType: 'ASC', sortOrder: 'ASC', code: 'ASC', id: 'ASC' },
    });

    return sizes.map((size) => ({
      id: size.id,
      name: size.name,
      code: size.code,
      sizeType: size.sizeType,
      sortOrder: size.sortOrder,
    }));
  }

  /**
   * Lists the active tags.
   *
   * @returns Active tags ordered by name.
   */
  async getTags(): Promise<PublicTagDto[]> {
    const tags = await this.tagsRepository.find({
      where: { isActive: true },
      order: { name: 'ASC', id: 'ASC' },
    });

    return tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
    }));
  }
}