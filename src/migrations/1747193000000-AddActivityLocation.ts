import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddActivityLocation1747193000000 implements MigrationInterface {
  name = 'AddActivityLocation1747193000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "lat" double precision`,
    );
    await queryRunner.query(
      `ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "lng" double precision`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "activities" DROP COLUMN IF EXISTS "lng"`,
    );
    await queryRunner.query(
      `ALTER TABLE "activities" DROP COLUMN IF EXISTS "lat"`,
    );
  }
}
