import { BrandResponseDto } from '../dto/catalog/brand/brand-response.dto';
import { CategoryResponseDto } from '../dto/catalog/category/category-response.dto';
import { ColorResponseDto } from '../dto/catalog/color/color-response.dto';
import { SizeResponseDto } from '../dto/catalog/size/size-response.dto';
import { TagResponseDto } from '../dto/catalog/tag/tag-response.dto';
import { ProductResponseDto } from '../dto/product/product-response.dto';
import { Brand } from '../entities/brand.entity';
import { Category } from '../entities/category.entity';
import { Color } from '../entities/color.entity';
import { Product } from '../entities/product.entity';
import { Size } from '../entities/size.entity';
import { Tag } from '../entities/tag.entity';

/**
 * Converts a Product entity into the admin response object.
 *
 * @param product Product entity.
 * @returns Admin response data.
 */
export function toProductResponse(product: Product): ProductResponseDto {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    shortDescription: product.shortDescription,
    price: product.price,
    categoryId: product.categoryId,
    brandId: product.brandId,
    gender: product.gender,
    sizeType: product.sizeType,
    status: product.status,
    isFeatured: product.isFeatured,
    metaTitle: product.metaTitle,
    metaDescription: product.metaDescription,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    deletedAt: product.deletedAt,
  };
}

/**
 * Converts a Category entity into the admin response object.
 *
 * @param category Category entity.
 * @returns Admin response data.
 */
export function toCategoryResponse(category: Category): CategoryResponseDto {
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
 * Converts a Brand entity into the admin response object.
 *
 * @param brand Brand entity.
 * @returns Admin response data.
 */
export function toBrandResponse(brand: Brand): BrandResponseDto {
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
 * Converts a Color entity into the admin response object.
 *
 * @param color Color entity.
 * @returns Admin response data.
 */
export function toColorResponse(color: Color): ColorResponseDto {
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
 * Converts a Size entity into the admin response object.
 *
 * @param size Size entity.
 * @returns Admin response data.
 */
export function toSizeResponse(size: Size): SizeResponseDto {
  return {
    id: size.id,
    name: size.name,
    code: size.code,
    sizeType: size.sizeType,
    sortOrder: size.sortOrder,
    isActive: size.isActive,
    createdAt: size.createdAt,
    updatedAt: size.updatedAt,
  };
}

/**
 * Converts a Tag entity into the admin response object.
 *
 * @param tag Tag entity.
 * @returns Admin response data.
 */
export function toTagResponse(tag: Tag): TagResponseDto {
  return {
    id: tag.id,
    name: tag.name,
    slug: tag.slug,
    isActive: tag.isActive,
    createdAt: tag.createdAt,
    updatedAt: tag.updatedAt,
  };
}