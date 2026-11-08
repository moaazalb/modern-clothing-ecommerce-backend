import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRefreshTokenHashToUsers1794074632659
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn(
      'users',
      'refreshTokenHash',
    );

    if (!hasColumn) {
      await queryRunner.query(`
        ALTER TABLE "users"
        ADD "refreshTokenHash" character varying(255)
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn(
      'users',
      'refreshTokenHash',
    );

    if (hasColumn) {
      await queryRunner.query(`
        ALTER TABLE "users"
        DROP COLUMN "refreshTokenHash"
      `);
    }
  }
}