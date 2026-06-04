import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRequiredVolunteersToActivities1749400000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE activities ADD COLUMN IF NOT EXISTS required_volunteers integer DEFAULT NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE activities DROP COLUMN IF EXISTS required_volunteers`,
    );
  }
}
