import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVolunteerTermsFields1748400000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS terms_accepted boolean DEFAULT NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS terms_version varchar DEFAULT NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS terms_accepted_at timestamp DEFAULT NULL;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE volunteers DROP COLUMN IF EXISTS terms_accepted_at;
    `);
    await queryRunner.query(`
      ALTER TABLE volunteers DROP COLUMN IF EXISTS terms_accepted;
    `);
    await queryRunner.query(`
      ALTER TABLE volunteers DROP COLUMN IF EXISTS terms_version;
    `);
  }
}
