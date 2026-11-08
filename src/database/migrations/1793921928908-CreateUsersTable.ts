import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUsersTable1793921928908 implements MigrationInterface {
    name = 'CreateUsersTable1793921928908'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('customer', 'admin')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "firstName" character varying(100) NOT NULL, "lastName" character varying(100) NOT NULL, "email" character varying(255) NOT NULL, "password" character varying(255) NOT NULL, "avatar" character varying(500), "role" "public"."users_role_enum" NOT NULL DEFAULT 'customer', "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    }

}
