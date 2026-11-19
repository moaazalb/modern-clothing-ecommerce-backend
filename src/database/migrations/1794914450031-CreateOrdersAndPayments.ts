import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateOrdersAndPayments1794914450031 implements MigrationInterface {
    name = 'CreateOrdersAndPayments1794914450031'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."order_status" AS ENUM('PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED')`);
        await queryRunner.query(`CREATE TYPE "public"."payment_method" AS ENUM('COD', 'ONLINE')`);
        await queryRunner.query(`CREATE TYPE "public"."payment_status" AS ENUM('UNPAID', 'PAID', 'REFUND_PENDING', 'REFUNDED')`);
        await queryRunner.query(`CREATE TABLE "orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "orderNumber" character varying(20) NOT NULL, "userId" uuid NOT NULL, "status" "public"."order_status" NOT NULL DEFAULT 'PENDING', "paymentMethod" "public"."payment_method" NOT NULL DEFAULT 'COD', "paymentStatus" "public"."payment_status" NOT NULL DEFAULT 'UNPAID', "currency" character varying(3) NOT NULL, "subtotal" numeric(14,2) NOT NULL, "shippingFee" numeric(10,2) NOT NULL, "total" numeric(14,2) NOT NULL, "customerEmail" character varying(255) NOT NULL, "shippingName" character varying(150) NOT NULL, "shippingPhone" character varying(20) NOT NULL, "shippingCountry" character varying(2) NOT NULL, "shippingCity" character varying(100) NOT NULL, "shippingAddress" character varying(300) NOT NULL, "shippingNotes" character varying(300), "customerNote" character varying(500), "idempotencyKey" character varying(64) NOT NULL, "cancelledAt" TIMESTAMP WITH TIME ZONE, "cancelReason" character varying(300), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_orders_user_idempotency" UNIQUE ("userId", "idempotencyKey"), CONSTRAINT "uq_orders_order_number" UNIQUE ("orderNumber"), CONSTRAINT "chk_orders_shipping_text" CHECK (length(trim("shippingName")) > 0 AND length(trim("shippingCity")) > 0 AND length(trim("shippingAddress")) > 0), CONSTRAINT "chk_orders_phone" CHECK ("shippingPhone" ~ '^[+]?[0-9]{7,15}$'), CONSTRAINT "chk_orders_country" CHECK ("shippingCountry" ~ '^[A-Z]{2}$'), CONSTRAINT "chk_orders_currency" CHECK ("currency" ~ '^[A-Z]{3}$'), CONSTRAINT "chk_orders_order_number" CHECK ("orderNumber" ~ '^MC-[A-Z0-9]{8}$'), CONSTRAINT "chk_orders_cancelled" CHECK (("status" = 'CANCELLED') = ("cancelledAt" IS NOT NULL)), CONSTRAINT "chk_orders_amounts" CHECK ("subtotal" >= 0 AND "shippingFee" >= 0 AND "total" = "subtotal" + "shippingFee"), CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_orders_status_created" ON "orders"  ("status", "createdAt") `);
        await queryRunner.query(`CREATE INDEX "idx_orders_user_created" ON "orders"  ("userId", "createdAt") `);
        await queryRunner.query(`CREATE TABLE "order_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "orderId" uuid NOT NULL, "variantId" uuid NOT NULL, "productName" character varying(200) NOT NULL, "sku" character varying(100) NOT NULL, "colorName" character varying(50) NOT NULL, "sizeName" character varying(20), "sizeCode" character varying(20), "unitPrice" numeric(10,2) NOT NULL, "quantity" integer NOT NULL, "lineTotal" numeric(14,2) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_order_items_order_variant" UNIQUE ("orderId", "variantId"), CONSTRAINT "chk_order_items_amounts" CHECK ("unitPrice" >= 0 AND "lineTotal" = "unitPrice" * "quantity"), CONSTRAINT "chk_order_items_quantity" CHECK ("quantity" > 0 AND "quantity" <= 100), CONSTRAINT "PK_005269d8574e6fac0493715c308" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_order_items_variant" ON "order_items"  ("variantId") `);
        await queryRunner.query(`CREATE TABLE "order_status_history" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "orderId" uuid NOT NULL, "fromStatus" "public"."order_status", "toStatus" "public"."order_status" NOT NULL, "changedByUserId" uuid, "note" character varying(300), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "chk_order_history_transition" CHECK ("fromStatus" IS NULL OR "fromStatus" <> "toStatus"), CONSTRAINT "PK_e6c66d853f155531985fc4f6ec8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_order_history_order_created" ON "order_status_history"  ("orderId", "createdAt") `);
        await queryRunner.query(`CREATE TYPE "public"."payment_attempt_status" AS ENUM('PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'REFUND_PENDING', 'REFUNDED')`);
        await queryRunner.query(`CREATE TABLE "payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "orderId" uuid NOT NULL, "provider" character varying(30) NOT NULL, "providerPaymentId" character varying(100), "status" "public"."payment_attempt_status" NOT NULL DEFAULT 'PENDING', "amount" numeric(14,2) NOT NULL, "currency" character varying(3) NOT NULL, "checkoutUrl" character varying(2000), "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "paidAt" TIMESTAMP WITH TIME ZONE, "failureReason" character varying(300), "refundedAt" TIMESTAMP WITH TIME ZONE, "refundError" character varying(300), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_payments_provider_payment" UNIQUE ("provider", "providerPaymentId"), CONSTRAINT "chk_payments_refunded_at" CHECK (("status" = 'REFUNDED') = ("refundedAt" IS NOT NULL)), CONSTRAINT "chk_payments_paid_at" CHECK (("status" IN ('SUCCEEDED', 'REFUND_PENDING', 'REFUNDED')) = ("paidAt" IS NOT NULL)), CONSTRAINT "chk_payments_currency" CHECK ("currency" ~ '^[A-Z]{3}$'), CONSTRAINT "chk_payments_amount" CHECK ("amount" > 0), CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_payments_one_succeeded_per_order" ON "payments"  ("orderId") WHERE "status" = 'SUCCEEDED'`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_payments_one_pending_per_order" ON "payments"  ("orderId") WHERE "status" = 'PENDING'`);
        await queryRunner.query(`CREATE INDEX "idx_payments_order" ON "payments"  ("orderId") `);
        await queryRunner.query(`CREATE TABLE "payment_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "provider" character varying(30) NOT NULL, "eventId" character varying(100) NOT NULL, "type" character varying(60) NOT NULL, "providerPaymentId" character varying(100), "paymentId" uuid, "payload" jsonb NOT NULL, "outcome" character varying(40) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_payment_events_provider_event" UNIQUE ("provider", "eventId"), CONSTRAINT "PK_9f1d16fc78b33e676940a32e8b5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_payment_events_payment" ON "payment_events"  ("paymentId") `);
        await queryRunner.query(`CREATE INDEX "idx_payment_events_provider_payment" ON "payment_events"  ("provider", "providerPaymentId") `);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "fk_orders_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "order_items" ADD CONSTRAINT "fk_order_items_order" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "order_items" ADD CONSTRAINT "fk_order_items_variant" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "order_status_history" ADD CONSTRAINT "fk_order_history_order" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "order_status_history" ADD CONSTRAINT "fk_order_history_user" FOREIGN KEY ("changedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "fk_payments_order" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payment_events" ADD CONSTRAINT "fk_payment_events_payment" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payment_events" DROP CONSTRAINT "fk_payment_events_payment"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "fk_payments_order"`);
        await queryRunner.query(`ALTER TABLE "order_status_history" DROP CONSTRAINT "fk_order_history_user"`);
        await queryRunner.query(`ALTER TABLE "order_status_history" DROP CONSTRAINT "fk_order_history_order"`);
        await queryRunner.query(`ALTER TABLE "order_items" DROP CONSTRAINT "fk_order_items_variant"`);
        await queryRunner.query(`ALTER TABLE "order_items" DROP CONSTRAINT "fk_order_items_order"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "fk_orders_user"`);
        await queryRunner.query(`DROP INDEX "public"."idx_payment_events_provider_payment"`);
        await queryRunner.query(`DROP INDEX "public"."idx_payment_events_payment"`);
        await queryRunner.query(`DROP TABLE "payment_events"`);
        await queryRunner.query(`DROP INDEX "public"."idx_payments_order"`);
        await queryRunner.query(`DROP INDEX "public"."uq_payments_one_pending_per_order"`);
        await queryRunner.query(`DROP INDEX "public"."uq_payments_one_succeeded_per_order"`);
        await queryRunner.query(`DROP TABLE "payments"`);
        await queryRunner.query(`DROP TYPE "public"."payment_attempt_status"`);
        await queryRunner.query(`DROP INDEX "public"."idx_order_history_order_created"`);
        await queryRunner.query(`DROP TABLE "order_status_history"`);
        await queryRunner.query(`DROP INDEX "public"."idx_order_items_variant"`);
        await queryRunner.query(`DROP TABLE "order_items"`);
        await queryRunner.query(`DROP INDEX "public"."idx_orders_user_created"`);
        await queryRunner.query(`DROP INDEX "public"."idx_orders_status_created"`);
        await queryRunner.query(`DROP TABLE "orders"`);
        await queryRunner.query(`DROP TYPE "public"."payment_status"`);
        await queryRunner.query(`DROP TYPE "public"."payment_method"`);
        await queryRunner.query(`DROP TYPE "public"."order_status"`);
    }

}
