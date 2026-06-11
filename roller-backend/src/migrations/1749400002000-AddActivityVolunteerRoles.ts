import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddActivityVolunteerRoles1749400002000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS activity_volunteer_roles (
        id varchar PRIMARY KEY,
        activity_id varchar NOT NULL,
        volunteer_id varchar NOT NULL,
        role_id varchar DEFAULT NULL,
        UNIQUE (activity_id, volunteer_id)
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS activity_volunteer_roles`);
  }
}
