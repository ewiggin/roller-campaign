import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRolePermissions1748900000000 implements MigrationInterface {
  name = 'AddRolePermissions1748900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "role_permissions" (
        "id" integer NOT NULL,
        "region_admin" text NOT NULL DEFAULT '[]',
        "volunteer" text NOT NULL DEFAULT '[]',
        "volunteer_manager" text NOT NULL DEFAULT '[]',
        "guest_manager" text NOT NULL DEFAULT '[]',
        "host_manager" text NOT NULL DEFAULT '[]',
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_role_permissions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      INSERT INTO "role_permissions" ("id", "region_admin")
      VALUES (1, '["dashboard","regions","hosts","guest-groups","guests","activities","volunteers"]')
      ON CONFLICT DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "role_permissions"`);
  }
}
