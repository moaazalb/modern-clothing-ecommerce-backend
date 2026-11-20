import { MigrationInterface, QueryRunner } from "typeorm";

export class HardenUserSessions1795039588132 implements MigrationInterface {
    name = 'HardenUserSessions1795039588132'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_sessions" ADD "previousRefreshTokenHash" character varying(64)`);
        await queryRunner.query(`ALTER TABLE "user_sessions" ADD "rotatedAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "user_sessions" ADD "lastUsedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "user_sessions" ADD CONSTRAINT "chk_user_sessions_revoked_hashes" CHECK ("revokedAt" IS NULL OR ("refreshTokenHash" IS NULL AND "previousRefreshTokenHash" IS NULL))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_sessions" DROP CONSTRAINT "chk_user_sessions_revoked_hashes"`);
        await queryRunner.query(`ALTER TABLE "user_sessions" DROP COLUMN "lastUsedAt"`);
        await queryRunner.query(`ALTER TABLE "user_sessions" DROP COLUMN "rotatedAt"`);
        await queryRunner.query(`ALTER TABLE "user_sessions" DROP COLUMN "previousRefreshTokenHash"`);
    }

}
