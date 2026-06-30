import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFoodShiftsPerGroupLimit1781600000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "campaign_settings"
      ADD COLUMN IF NOT EXISTS "max_food_shifts_per_group" int NOT NULL DEFAULT 1
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "campaign_settings"
      DROP COLUMN IF EXISTS "max_food_shifts_per_group"
    `);
  }
}
