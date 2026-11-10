import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, In } from 'typeorm';

import {
  buildPaginated,
  PaginatedResponseDto,
} from '../../../common/dto/paginated-response.dto';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { AdminProductDetailDto } from '../../dto/product/admin-product-detail.dto';
import { AdminProductListQueryDto } from '../../dto/product/admin-product-list-query.dto';
import { ProductResponseDto } from '../../dto/product/product-response.dto';
import { Color } from '../../entities/color.entity';
import { ProductColor } from '../../entities/product-color.entity';
import { ProductSize } from '../../entities/product-size.entity';
import { ProductTag } from '../../entities/product-tag.entity';
import { Product } from '../../entities/product.entity';
import { Size } from '../../entities/size.entity';
import { Tag } from '../../entities/tag.entity';
import {
  toBrandResponse,
  toCategoryResponse,
  toColorResponse,
  toProductResponse,
  toSizeResponse,
  toTagResponse,
} from '../../mappers/product.mappers';
import { ProductImageService } from '../product/product-image.service';
import { ProductSearchService } from '../product/product-search.service';
import { ProductVariantService } from '../product/product-variant.service';

/**
 * Admin read operations on products: the list, the trash and the details.
 */
@Injectable()
export class AdminProductQueryService {
  /**
   * Injects the services this class relies on.
   *
   * @param dataSource TypeORM data source.
   * @param searchService Shared product search engine.
   * @param variantService Loads the variants of a product.
   * @param imageService Loads the images of a product.
   */
  constructor(
    private readonly dataSource: DataSource,
    private readonly searchService: ProductSearchService,
    private readonly variantService: ProductVariantService,
    private readonly imageService: ProductImageService,
  ) {}

  /**
   * Loads products by id and returns them in the order of the ids.
   *
   * @param ids Product ids in the wanted order.
   * @param withDeleted True to include soft-deleted products (trash).
   * @returns The products in the order of the ids.
   */
  private async loadInOrder(
    ids: string[],
    withDeleted: boolean,
  ): Promise<Product[]> {
    if (ids.length === 0) {
      return [];
    }

    const products = await this.dataSource.manager.find(Product, {
      where: { id: In(ids) },
      withDeleted,
    });

    const byId = new Map(products.map((product) => [product.id, product]));

    return ids
      .map((id) => byId.get(id))
      .filter((product): product is Product => product !== undefined);
  }

  /**
   * Lists products that are not deleted, with filters, sorting and pagination.
   *
   * @param query Validated list query.
   * @returns A page of products.
   * @throws UnprocessableEntityException If minPrice is greater than maxPrice.
   */
  async findAll(
    query: AdminProductListQueryDto,
  ): Promise<PaginatedResponseDto<ProductResponseDto>> {
    const { ids, total } = await this.searchService.searchIds(query, 'admin');
    const products = await this.loadInOrder(ids, false);

    return buildPaginated(
      products.map((product) => toProductResponse(product)),
      total,
      query.page,
      query.limit,
    );
  }

  /**
   * Lists soft-deleted products, most recently deleted first.
   *
   * @param query Pagination parameters.
   * @returns A page of deleted products.
   */
  async findTrash(
    query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<ProductResponseDto>> {
    const { ids, total } = await this.searchService.searchIds(
      { page: query.page, limit: query.limit },
      'trash',
    );
    const products = await this.loadInOrder(ids, true);

    return buildPaginated(
      products.map((product) => toProductResponse(product)),
      total,
      query.page,
      query.limit,
    );
  }

  /**
   * Retrieves one product with everything related to it. Deleted products
   * can be read too (they show a deletedAt date).
   *
   * @param id Product UUID.
   * @returns The product with its category, brand, colors, sizes, tags, variants and images.
   * @throws NotFoundException If the product does not exist.
   */
  async findOne(id: string): Promise<AdminProductDetailDto> {
    const manager = this.dataSource.manager;

    const product = await manager.findOne(Product, {
      where: { id },
      withDeleted: true,
      relations: { category: true, brand: true },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} was not found.`);
    }

    const [colors, sizes, tags, variants, images] = await Promise.all([
      manager
        .createQueryBuilder(Color, 'color')
        .innerJoin(ProductColor, 'link', 'link.colorId = color.id')
        .where('link.productId = :id', { id })
        .orderBy('color.name', 'ASC')
        .addOrderBy('color.id', 'ASC')
        .getMany(),
      manager
        .createQueryBuilder(Size, 'size')
        .innerJoin(ProductSize, 'link', 'link.sizeId = size.id')
        .where('link.productId = :id', { id })
        .orderBy('size.sizeType', 'ASC')
        .addOrderBy('size.sortOrder', 'ASC')
        .addOrderBy('size.id', 'ASC')
        .getMany(),
      manager
        .createQueryBuilder(Tag, 'tag')
        .innerJoin(ProductTag, 'link', 'link.tagId = tag.id')
        .where('link.productId = :id', { id })
        .orderBy('tag.name', 'ASC')
        .addOrderBy('tag.id', 'ASC')
        .getMany(),
      this.variantService.findAll(id),
      this.imageService.findAll(id),
    ]);

    return {
      ...toProductResponse(product),
      category: toCategoryResponse(product.category),
      brand: product.brand ? toBrandResponse(product.brand) : null,
      colors: colors.map((color) => toColorResponse(color)),
      sizes: sizes.map((size) => toSizeResponse(size)),
      tags: tags.map((tag) => toTagResponse(tag)),
      variants,
      images,
    };
  }
}