import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCarts1781052000000 implements MigrationInterface {
  name = 'CreateCarts1781052000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "carts" (
        "id" uuid NOT NULL,
        "region_id" uuid NOT NULL,
        "host_id" uuid DEFAULT NULL,
        "number" varchar NOT NULL DEFAULT '',
        "primary_location" text DEFAULT NULL,
        "secondary_location" text DEFAULT NULL,
        "image_key" varchar DEFAULT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_carts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_carts_region" FOREIGN KEY ("region_id")
          REFERENCES "regions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_carts_host" FOREIGN KEY ("host_id")
          REFERENCES "hosts"("id") ON DELETE SET NULL
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "carts"`);
  }
}
