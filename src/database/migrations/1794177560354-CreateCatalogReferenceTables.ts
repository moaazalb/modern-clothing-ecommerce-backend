import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCatalogReferenceTables1794177560354 implements MigrationInterface {
    name = 'CreateCatalogReferenceTables1794177560354'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "citext"`);
        await queryRunner.query(`CREATE TABLE "brands" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" citext NOT NULL, "slug" character varying(120) NOT NULL, "description" text, "logoUrl" character varying(500), "websiteUrl" character varying(500), "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_brands_slug" UNIQUE ("slug"), CONSTRAINT "uq_brands_name" UNIQUE ("name"), CONSTRAINT "chk_brands_name_length" CHECK (char_length("name") <= 100), CONSTRAINT "chk_brands_name_not_blank" CHECK (length(trim("name")) > 0), CONSTRAINT "chk_brands_slug_format" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), CONSTRAINT "PK_b0c437120b624da1034a81fc561" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_brands_is_active" ON "brands"  ("isActive") `);
        await queryRunner.query(`CREATE TABLE "categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, "slug" character varying(120) NOT NULL, "description" text, "parentId" uuid, "isActive" boolean NOT NULL DEFAULT true, "sortOrder" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_categories_slug" UNIQUE ("slug"), CONSTRAINT "chk_categories_sort_order" CHECK ("sortOrder" >= 0), CONSTRAINT "chk_categories_no_self_parent" CHECK ("parentId" IS NULL OR "parentId" <> "id"), CONSTRAINT "chk_categories_name_not_blank" CHECK (length(trim("name")) > 0), CONSTRAINT "chk_categories_slug_format" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_categories_parent" ON "categories"  ("parentId") `);
        await queryRunner.query(`CREATE TABLE "colors" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" citext NOT NULL, "slug" character varying(70) NOT NULL, "hexCode" character varying(7) NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_colors_slug" UNIQUE ("slug"), CONSTRAINT "uq_colors_name" UNIQUE ("name"), CONSTRAINT "chk_colors_name_length" CHECK (char_length("name") <= 50), CONSTRAINT "chk_colors_name_not_blank" CHECK (length(trim("name")) > 0), CONSTRAINT "chk_colors_slug_format" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), CONSTRAINT "chk_colors_hex_format" CHECK ("hexCode" ~ '^#[0-9A-Fa-f]{6}$'), CONSTRAINT "PK_3a62edc12d29307872ab1777ced" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_colors_is_active" ON "colors"  ("isActive") `);
        await queryRunner.query(`CREATE TYPE "public"."size_type" AS ENUM('APPAREL', 'FOOTWEAR')`);
        await queryRunner.query(`CREATE TABLE "sizes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(20) NOT NULL, "code" character varying(20) NOT NULL, "sizeType" "public"."size_type" NOT NULL, "sortOrder" integer NOT NULL DEFAULT '0', "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_sizes_id_sizetype" UNIQUE ("id", "sizeType"), CONSTRAINT "uq_sizes_name_type" UNIQUE ("name", "sizeType"), CONSTRAINT "uq_sizes_code_type" UNIQUE ("code", "sizeType"), CONSTRAINT "chk_sizes_sort_order" CHECK ("sortOrder" >= 0), CONSTRAINT "PK_09ffc681886e25eb5ce3b319fab" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_sizes_type_active_sort" ON "sizes"  ("sizeType", "isActive", "sortOrder") `);
        await queryRunner.query(`CREATE TABLE "tags" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" citext NOT NULL, "slug" character varying(70) NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_tags_slug" UNIQUE ("slug"), CONSTRAINT "uq_tags_name" UNIQUE ("name"), CONSTRAINT "chk_tags_name_length" CHECK (char_length("name") <= 50), CONSTRAINT "chk_tags_name_not_blank" CHECK (length(trim("name")) > 0), CONSTRAINT "chk_tags_slug_format" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), CONSTRAINT "PK_e7dc17249a1148a1970748eda99" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_tags_is_active" ON "tags"  ("isActive") `);
        await queryRunner.query(`ALTER TABLE "categories" ADD CONSTRAINT "fk_categories_parent" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "categories" DROP CONSTRAINT "fk_categories_parent"`);
        await queryRunner.query(`DROP INDEX "public"."idx_tags_is_active"`);
        await queryRunner.query(`DROP TABLE "tags"`);
        await queryRunner.query(`DROP INDEX "public"."idx_sizes_type_active_sort"`);
        await queryRunner.query(`DROP TABLE "sizes"`);
        await queryRunner.query(`DROP TYPE "public"."size_type"`);
        await queryRunner.query(`DROP INDEX "public"."idx_colors_is_active"`);
        await queryRunner.query(`DROP TABLE "colors"`);
        await queryRunner.query(`DROP INDEX "public"."idx_categories_parent"`);
        await queryRunner.query(`DROP TABLE "categories"`);
        await queryRunner.query(`DROP INDEX "public"."idx_brands_is_active"`);
        await queryRunner.query(`DROP TABLE "brands"`);
    }

}
