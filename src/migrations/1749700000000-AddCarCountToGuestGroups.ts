import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCarCountToGuestGroups1749700000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE guest_groups ADD COLUMN IF NOT EXISTS car_count INTEGER DEFAULT NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE guest_groups DROP COLUMN IF EXISTS car_count`,
    );
  }
}
