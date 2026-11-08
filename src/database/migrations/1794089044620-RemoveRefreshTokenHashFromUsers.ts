import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveRefreshTokenHashFromUsers1794089044620 implements MigrationInterface {
    name = 'RemoveRefreshTokenHashFromUsers1794089044620'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "refreshTokenHash"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "refreshTokenHash" character varying(255)`);
    }

}
