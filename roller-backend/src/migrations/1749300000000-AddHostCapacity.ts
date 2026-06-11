import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHostCapacity1749300000000 implements MigrationInterface {
  name = 'AddHostCapacity1749300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "hosts" ADD COLUMN IF NOT EXISTS "capacity" integer`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "hosts" DROP COLUMN IF EXISTS "capacity"`,
    );
  }
}
