import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUserSessionsTable1794082423590 implements MigrationInterface {
    name = 'CreateUserSessionsTable1794082423590'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "user_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "refreshTokenHash" character varying(64) NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "revokedAt" TIMESTAMP WITH TIME ZONE, "userAgent" character varying(500), "ipAddress" character varying(45), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e93e031a5fed190d4789b6bfd83" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_55fa4db8406ed66bc704432842" ON "user_sessions"  ("userId") `);
        await queryRunner.query(`ALTER TABLE "user_sessions" ADD CONSTRAINT "FK_55fa4db8406ed66bc7044328427" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_sessions" DROP CONSTRAINT "FK_55fa4db8406ed66bc7044328427"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_55fa4db8406ed66bc704432842"`);
        await queryRunner.query(`DROP TABLE "user_sessions"`);
    }

}
