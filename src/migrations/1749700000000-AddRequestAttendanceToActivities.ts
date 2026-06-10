import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRequestAttendanceToActivities1749700000000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE activities ADD COLUMN IF NOT EXISTS request_attendance boolean NOT NULL DEFAULT false`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE activities DROP COLUMN IF EXISTS request_attendance`,
    );
  }
}
