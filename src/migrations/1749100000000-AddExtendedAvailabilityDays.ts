import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExtendedAvailabilityDays1749100000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS saturday_prev_morning boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS saturday_prev_afternoon boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS sunday_prev_morning boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS sunday_prev_afternoon boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS monday_next_morning boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS monday_next_afternoon boolean NOT NULL DEFAULT false
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE volunteers DROP COLUMN IF EXISTS saturday_prev_morning
    `);
    await queryRunner.query(`
      ALTER TABLE volunteers DROP COLUMN IF EXISTS saturday_prev_afternoon
    `);
    await queryRunner.query(`
      ALTER TABLE volunteers DROP COLUMN IF EXISTS sunday_prev_morning
    `);
    await queryRunner.query(`
      ALTER TABLE volunteers DROP COLUMN IF EXISTS sunday_prev_afternoon
    `);
    await queryRunner.query(`
      ALTER TABLE volunteers DROP COLUMN IF EXISTS monday_next_morning
    `);
    await queryRunner.query(`
      ALTER TABLE volunteers DROP COLUMN IF EXISTS monday_next_afternoon
    `);
  }
}
