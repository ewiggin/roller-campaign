import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVolunteerCongregation1781200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "volunteers" ADD COLUMN IF NOT EXISTS "host_id" uuid DEFAULT NULL REFERENCES "hosts"("id") ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "volunteers" DROP COLUMN IF EXISTS "host_id"`,
    );
  }
}
