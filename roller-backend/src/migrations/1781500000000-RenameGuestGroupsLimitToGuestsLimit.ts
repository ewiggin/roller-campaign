import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameGuestGroupsLimitToGuestsLimit1781500000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "campaign_settings"
      RENAME COLUMN "max_guest_groups_per_preaching_group" TO "max_guests_per_preaching_group"
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "campaign_settings"
      RENAME COLUMN "max_guests_per_preaching_group" TO "max_guest_groups_per_preaching_group"
    `);
  }
}
