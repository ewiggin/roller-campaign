import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGroupActivityRequests1749800000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS group_activity_requests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id uuid NOT NULL REFERENCES guest_groups(id) ON DELETE CASCADE,
        activity_id uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
        preference integer NOT NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        CONSTRAINT uq_group_activity_request UNIQUE (group_id, activity_id)
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS group_activity_requests`);
  }
}
