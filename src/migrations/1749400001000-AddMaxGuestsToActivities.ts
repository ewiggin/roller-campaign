import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMaxGuestsToActivities1749400001000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE activities ADD COLUMN IF NOT EXISTS max_guests integer DEFAULT NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE activities DROP COLUMN IF EXISTS max_guests`,
    );
  }
}
