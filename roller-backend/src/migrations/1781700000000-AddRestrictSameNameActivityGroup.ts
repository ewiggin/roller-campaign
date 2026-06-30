import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRestrictSameNameActivityGroup1781700000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(
      `ALTER TABLE campaign_settings ADD COLUMN restrict_same_name_activity_group boolean NOT NULL DEFAULT 1`,
    );
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(
      `ALTER TABLE campaign_settings DROP COLUMN restrict_same_name_activity_group`,
    );
  }
}
