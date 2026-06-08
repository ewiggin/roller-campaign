import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPreachingGroupTerritoryKey1781051000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE activity_preaching_groups ADD COLUMN IF NOT EXISTS territory_key VARCHAR`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE activity_preaching_groups DROP COLUMN IF EXISTS territory_key`,
    );
  }
}
