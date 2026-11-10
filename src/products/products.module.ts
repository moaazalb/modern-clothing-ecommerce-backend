import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AdminBrandsController } from './controllers/admin/admin-brands.controller';
import { AdminCategoriesController } from './controllers/admin/admin-categories.controller';
import { AdminColorsController } from './controllers/admin/admin-colors.controller';
import { AdminProductImagesController } from './controllers/admin/admin-product-images.controller';
import { AdminProductVariantsController } from './controllers/admin/admin-product-variants.controller';
import { AdminProductsController } from './controllers/admin/admin-products.controller';
import { AdminProductsQueryController } from './controllers/admin/admin-products-query.controller';
import { AdminSizesController } from './controllers/admin/admin-sizes.controller';
import { AdminTagsController } from './controllers/admin/admin-tags.controller';
import { PublicCatalogController } from './controllers/public/public-catalog.controller';
import { PublicProductsController } from './controllers/public/public-products.controller';
import { Brand } from './entities/brand.entity';
import { Category } from './entities/category.entity';
import { Color } from './entities/color.entity';
import { ProductColor } from './entities/product-color.entity';
import { ProductImage } from './entities/product-image.entity';
import { ProductSize } from './entities/product-size.entity';
import { ProductTag } from './entities/product-tag.entity';
import { ProductVariant } from './entities/product-variant.entity';
import { Product } from './entities/product.entity';
import { Size } from './entities/size.entity';
import { Tag } from './entities/tag.entity';
import { AdminProductQueryService } from './services/admin/admin-product-query.service';
import { BrandService } from './services/brand/brand.service';
import { CategoryService } from './services/category/category.service';
import { CategoryVisibilityService } from './services/category/category-visibility.service';
import { ColorService } from './services/color/color.service';
import { ProductImageService } from './services/product/product-image.service';
import { ProductSearchService } from './services/product/product-search.service';
import { ProductVariantService } from './services/product/product-variant.service';
import { ProductService } from './services/product/product.service';
import { PublicCatalogService } from './services/public/public-catalog.service';
import { PublicProductService } from './services/public/public-product.service';
import { SizeService } from './services/size/size.service';
import { StockService } from './services/stock/stock.service';
import { TagService } from './services/tag/tag.service';
import { LocalStorageProvider } from './storage/local-storage.provider';
import { StorageProvider } from './storage/storage.provider';

/**
 * Products module.
 *
 * Registers every product-related entity (required because the app uses
 * autoLoadEntities), the services of the product catalog, the file storage
 * provider, and the admin and public controllers.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Brand,
      Category,
      Color,
      Product,
      ProductColor,
      ProductImage,
      ProductSize,
      ProductTag,
      ProductVariant,
      Size,
      Tag,
    ]),
  ],
  controllers: [
    AdminBrandsController,
    AdminCategoriesController,
    AdminColorsController,
    AdminProductImagesController,
    AdminProductVariantsController,
    AdminProductsController,
    AdminProductsQueryController,
    AdminSizesController,
    AdminTagsController,
    PublicCatalogController,
    PublicProductsController,
  ],
  providers: [
    AdminProductQueryService,
    BrandService,
    CategoryService,
    CategoryVisibilityService,
    ColorService,
    ProductImageService,
    ProductSearchService,
    ProductService,
    ProductVariantService,
    PublicCatalogService,
    PublicProductService,
    SizeService,
    StockService,
    TagService,

    // The storage provider can be replaced (S3, Cloudinary...) by changing
    // useClass, without touching the rest of the module.
    { provide: StorageProvider, useClass: LocalStorageProvider },
  ],
  exports: [
    AdminProductQueryService,
    BrandService,
    CategoryService,
    CategoryVisibilityService,
    ColorService,
    ProductImageService,
    ProductSearchService,
    ProductService,
    ProductVariantService,
    PublicCatalogService,
    PublicProductService,
    SizeService,
    StockService,
    TagService,
  ],
})
export class ProductsModule {}