import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsPreachingShiftToActivities1749600000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE activities ADD COLUMN IF NOT EXISTS is_preaching_shift boolean NOT NULL DEFAULT false`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE activities DROP COLUMN IF EXISTS is_preaching_shift`,
    );
  }
}
