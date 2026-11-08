import { MigrationInterface, QueryRunner } from "typeorm";

export class MakeSessionRefreshTokenHashNullable1794084967849 implements MigrationInterface {
    name = 'MakeSessionRefreshTokenHashNullable1794084967849'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_sessions" ALTER COLUMN "refreshTokenHash" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_sessions" ALTER COLUMN "refreshTokenHash" SET NOT NULL`);
    }

}
