import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSmtpSettings1748300000000 implements MigrationInterface {
  name = 'AddSmtpSettings1748300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "smtp_settings" (
        "id" integer NOT NULL DEFAULT 1,
        "host" varchar,
        "port" integer,
        "secure" boolean NOT NULL DEFAULT false,
        "user" varchar,
        "password" varchar,
        "from_name" varchar,
        "from_email" varchar,
        "enabled" boolean NOT NULL DEFAULT false,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_smtp_settings" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `INSERT INTO "smtp_settings" ("id") VALUES (1) ON CONFLICT DO NOTHING`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "smtp_settings"`);
  }
}
