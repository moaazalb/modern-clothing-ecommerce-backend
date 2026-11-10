import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateProductsAndJunctionTables1794179037732 implements MigrationInterface {
    name = 'CreateProductsAndJunctionTables1794179037732'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."product_gender" AS ENUM('MEN', 'WOMEN', 'UNISEX')`);
        await queryRunner.query(`CREATE TYPE "public"."product_status" AS ENUM('DRAFT', 'ACTIVE', 'ARCHIVED')`);
        await queryRunner.query(`CREATE TABLE "products" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(200) NOT NULL, "slug" character varying(220) NOT NULL, "description" text, "shortDescription" character varying(300), "price" numeric(10,2) NOT NULL, "categoryId" uuid NOT NULL, "brandId" uuid, "gender" "public"."product_gender" NOT NULL, "sizeType" "public"."size_type", "status" "public"."product_status" NOT NULL DEFAULT 'DRAFT', "isFeatured" boolean NOT NULL DEFAULT false, "metaTitle" character varying(70), "metaDescription" character varying(160), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "uq_products_id_sizetype" UNIQUE ("id", "sizeType"), CONSTRAINT "uq_products_slug" UNIQUE ("slug"), CONSTRAINT "chk_products_name_not_blank" CHECK (length(trim("name")) > 0), CONSTRAINT "chk_products_slug_format" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), CONSTRAINT "chk_products_active_price" CHECK ("status" <> 'ACTIVE' OR "price" > 0), CONSTRAINT "chk_products_price" CHECK ("price" >= 0), CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_products_storefront" ON "products"  ("status", "gender", "createdAt") WHERE "deletedAt" IS NULL`);
        await queryRunner.query(`CREATE INDEX "idx_products_brand" ON "products"  ("brandId") `);
        await queryRunner.query(`CREATE INDEX "idx_products_category" ON "products"  ("categoryId") `);
        await queryRunner.query(`CREATE TABLE "product_colors" ("productId" uuid NOT NULL, "colorId" uuid NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_72c15a971299be8f991112d3192" PRIMARY KEY ("productId", "colorId"))`);
        await queryRunner.query(`CREATE INDEX "idx_product_colors_color" ON "product_colors"  ("colorId") `);
        await queryRunner.query(`CREATE TABLE "product_sizes" ("productId" uuid NOT NULL, "sizeId" uuid NOT NULL, "sizeType" "public"."size_type" NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_5a8587c23b61269ff3bda09a0c8" PRIMARY KEY ("productId", "sizeId"))`);
        await queryRunner.query(`CREATE INDEX "idx_product_sizes_size" ON "product_sizes"  ("sizeId") `);
        await queryRunner.query(`CREATE TABLE "product_tags" ("productId" uuid NOT NULL, "tagId" uuid NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_5211d54db48ab1656d2a475c77b" PRIMARY KEY ("productId", "tagId"))`);
        await queryRunner.query(`CREATE INDEX "idx_product_tags_tag" ON "product_tags"  ("tagId") `);
        await queryRunner.query(`ALTER TABLE "products" ADD CONSTRAINT "fk_products_category" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "products" ADD CONSTRAINT "fk_products_brand" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_colors" ADD CONSTRAINT "fk_product_colors_product" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_colors" ADD CONSTRAINT "fk_product_colors_color" FOREIGN KEY ("colorId") REFERENCES "colors"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_sizes" ADD CONSTRAINT "fk_ps_product_type" FOREIGN KEY ("productId", "sizeType") REFERENCES "products"("id","sizeType") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_sizes" ADD CONSTRAINT "fk_ps_size_type" FOREIGN KEY ("sizeId", "sizeType") REFERENCES "sizes"("id","sizeType") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_tags" ADD CONSTRAINT "fk_product_tags_product" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_tags" ADD CONSTRAINT "fk_product_tags_tag" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "product_tags" DROP CONSTRAINT "fk_product_tags_tag"`);
        await queryRunner.query(`ALTER TABLE "product_tags" DROP CONSTRAINT "fk_product_tags_product"`);
        await queryRunner.query(`ALTER TABLE "product_sizes" DROP CONSTRAINT "fk_ps_size_type"`);
        await queryRunner.query(`ALTER TABLE "product_sizes" DROP CONSTRAINT "fk_ps_product_type"`);
        await queryRunner.query(`ALTER TABLE "product_colors" DROP CONSTRAINT "fk_product_colors_color"`);
        await queryRunner.query(`ALTER TABLE "product_colors" DROP CONSTRAINT "fk_product_colors_product"`);
        await queryRunner.query(`ALTER TABLE "products" DROP CONSTRAINT "fk_products_brand"`);
        await queryRunner.query(`ALTER TABLE "products" DROP CONSTRAINT "fk_products_category"`);
        await queryRunner.query(`DROP INDEX "public"."idx_product_tags_tag"`);
        await queryRunner.query(`DROP TABLE "product_tags"`);
        await queryRunner.query(`DROP INDEX "public"."idx_product_sizes_size"`);
        await queryRunner.query(`DROP TABLE "product_sizes"`);
        await queryRunner.query(`DROP INDEX "public"."idx_product_colors_color"`);
        await queryRunner.query(`DROP TABLE "product_colors"`);
        await queryRunner.query(`DROP INDEX "public"."idx_products_category"`);
        await queryRunner.query(`DROP INDEX "public"."idx_products_brand"`);
        await queryRunner.query(`DROP INDEX "public"."idx_products_storefront"`);
        await queryRunner.query(`DROP TABLE "products"`);
        await queryRunner.query(`DROP TYPE "public"."product_status"`);
        await queryRunner.query(`DROP TYPE "public"."product_gender"`);
    }

}
