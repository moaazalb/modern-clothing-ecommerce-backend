import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Seeds the base colors and sizes.
 * Idempotent: rows that already exist are skipped.
 */
export class SeedColorsAndSizes1794177600000 implements MigrationInterface {
    name = 'SeedColorsAndSizes1794177600000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            INSERT INTO "colors" ("name", "slug", "hexCode") VALUES
              ('Black', 'black', '#000000'),
              ('White', 'white', '#FFFFFF'),
              ('Gray', 'gray', '#808080'),
              ('Navy', 'navy', '#000080'),
              ('Blue', 'blue', '#0000FF'),
              ('Red', 'red', '#FF0000'),
              ('Green', 'green', '#008000'),
              ('Beige', 'beige', '#F5F5DC')
            ON CONFLICT DO NOTHING
        `);

        await queryRunner.query(`
            INSERT INTO "sizes" ("name", "code", "sizeType", "sortOrder") VALUES
              ('Extra Small', 'XS', 'APPAREL', 1),
              ('Small', 'S', 'APPAREL', 2),
              ('Medium', 'M', 'APPAREL', 3),
              ('Large', 'L', 'APPAREL', 4),
              ('Extra Large', 'XL', 'APPAREL', 5),
              ('Double Extra Large', 'XXL', 'APPAREL', 6),
              ('Size 36', '36', 'FOOTWEAR', 1),
              ('Size 37', '37', 'FOOTWEAR', 2),
              ('Size 38', '38', 'FOOTWEAR', 3),
              ('Size 39', '39', 'FOOTWEAR', 4),
              ('Size 40', '40', 'FOOTWEAR', 5),
              ('Size 41', '41', 'FOOTWEAR', 6),
              ('Size 42', '42', 'FOOTWEAR', 7),
              ('Size 43', '43', 'FOOTWEAR', 8),
              ('Size 44', '44', 'FOOTWEAR', 9),
              ('Size 45', '45', 'FOOTWEAR', 10),
              ('Size 46', '46', 'FOOTWEAR', 11)
            ON CONFLICT DO NOTHING
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DELETE FROM "sizes" WHERE ("code", "sizeType") IN (
              ('XS','APPAREL'),('S','APPAREL'),('M','APPAREL'),('L','APPAREL'),('XL','APPAREL'),('XXL','APPAREL'),
              ('36','FOOTWEAR'),('37','FOOTWEAR'),('38','FOOTWEAR'),('39','FOOTWEAR'),('40','FOOTWEAR'),
              ('41','FOOTWEAR'),('42','FOOTWEAR'),('43','FOOTWEAR'),('44','FOOTWEAR'),('45','FOOTWEAR'),('46','FOOTWEAR')
            )
        `);
        await queryRunner.query(`
            DELETE FROM "colors" WHERE "slug" IN
              ('black','white','gray','navy','blue','red','green','beige')
        `);
    }
}