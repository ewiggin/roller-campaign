import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddActivityImageKey1781050000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE activities ADD COLUMN IF NOT EXISTS image_key VARCHAR`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE activities DROP COLUMN IF EXISTS image_key`,
    );
  }
}
