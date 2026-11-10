import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateVariantsAndImages1794179439637 implements MigrationInterface {
    name = 'CreateVariantsAndImages1794179439637'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "product_images" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "productId" uuid NOT NULL, "colorId" uuid, "storageKey" character varying(500) NOT NULL, "altText" character varying(255), "sortOrder" integer NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_images_sort" UNIQUE NULLS NOT DISTINCT ("productId", "colorId", "sortOrder") DEFERRABLE INITIALLY IMMEDIATE, CONSTRAINT "uq_images_storage_key" UNIQUE ("storageKey"), CONSTRAINT "chk_image_sort" CHECK ("sortOrder" >= 0), CONSTRAINT "PK_1974264ea7265989af8392f63a1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "product_variants" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "productId" uuid NOT NULL, "colorId" uuid NOT NULL, "sizeId" uuid, "sku" character varying(100) NOT NULL, "price" numeric(10,2), "stockQuantity" integer NOT NULL DEFAULT '0', "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_variants_sku" UNIQUE ("sku"), CONSTRAINT "chk_variant_sku" CHECK ("sku" ~ '^[A-Z0-9][A-Z0-9_-]*$'), CONSTRAINT "chk_variant_price" CHECK ("price" IS NULL OR "price" >= 0), CONSTRAINT "chk_variant_stock" CHECK ("stockQuantity" >= 0), CONSTRAINT "PK_281e3f2c55652d6a22c0aa59fd7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_variant_combo_unsized" ON "product_variants"  ("productId", "colorId") WHERE "sizeId" IS NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_variant_combo_sized" ON "product_variants"  ("productId", "colorId", "sizeId") WHERE "sizeId" IS NOT NULL`);
        await queryRunner.query(`CREATE INDEX "idx_variants_product_size" ON "product_variants"  ("productId", "sizeId") `);
        await queryRunner.query(`CREATE INDEX "idx_variants_product_color" ON "product_variants"  ("productId", "colorId") `);
        await queryRunner.query(`ALTER TABLE "product_images" ADD CONSTRAINT "fk_images_product" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_images" ADD CONSTRAINT "fk_image_product_color" FOREIGN KEY ("productId", "colorId") REFERENCES "product_colors"("productId","colorId") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_variants" ADD CONSTRAINT "fk_variant_product" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_variants" ADD CONSTRAINT "fk_variant_product_color" FOREIGN KEY ("productId", "colorId") REFERENCES "product_colors"("productId","colorId") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_variants" ADD CONSTRAINT "fk_variant_product_size" FOREIGN KEY ("productId", "sizeId") REFERENCES "product_sizes"("productId","sizeId") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "product_variants" DROP CONSTRAINT "fk_variant_product_size"`);
        await queryRunner.query(`ALTER TABLE "product_variants" DROP CONSTRAINT "fk_variant_product_color"`);
        await queryRunner.query(`ALTER TABLE "product_variants" DROP CONSTRAINT "fk_variant_product"`);
        await queryRunner.query(`ALTER TABLE "product_images" DROP CONSTRAINT "fk_image_product_color"`);
        await queryRunner.query(`ALTER TABLE "product_images" DROP CONSTRAINT "fk_images_product"`);
        await queryRunner.query(`DROP INDEX "public"."idx_variants_product_color"`);
        await queryRunner.query(`DROP INDEX "public"."idx_variants_product_size"`);
        await queryRunner.query(`DROP INDEX "public"."uq_variant_combo_sized"`);
        await queryRunner.query(`DROP INDEX "public"."uq_variant_combo_unsized"`);
        await queryRunner.query(`DROP TABLE "product_variants"`);
        await queryRunner.query(`DROP TABLE "product_images"`);
    }

}
