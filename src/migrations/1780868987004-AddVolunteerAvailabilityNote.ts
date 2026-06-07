import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVolunteerAvailabilityNote1780868987004 implements MigrationInterface {
  name = 'AddVolunteerAvailabilityNote1780868987004';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "volunteer_availability" ADD COLUMN IF NOT EXISTS "note" varchar`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "volunteer_availability" DROP COLUMN IF EXISTS "note"`,
    );
  }
}
