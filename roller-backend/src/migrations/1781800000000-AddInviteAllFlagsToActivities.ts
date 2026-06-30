import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInviteAllFlagsToActivities1781800000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(
      `ALTER TABLE activities ADD COLUMN invite_all_congregation boolean NOT NULL DEFAULT 0`,
    );
    await runner.query(
      `ALTER TABLE activities ADD COLUMN invite_all_region boolean NOT NULL DEFAULT 0`,
    );
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE activities DROP COLUMN invite_all_region`);
    await runner.query(
      `ALTER TABLE activities DROP COLUMN invite_all_congregation`,
    );
  }
}
