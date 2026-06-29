import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGuestGroupsPerPreachingGroupLimit1781400000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "campaign_settings"
      ADD COLUMN IF NOT EXISTS "max_guest_groups_per_preaching_group" integer NOT NULL DEFAULT 3
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "campaign_settings"
      DROP COLUMN IF EXISTS "max_guest_groups_per_preaching_group"
    `);
  }
}
