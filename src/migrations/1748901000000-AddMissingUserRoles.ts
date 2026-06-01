import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMissingUserRoles1748901000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const isSqlite = queryRunner.connection.options.type === 'better-sqlite3';
    if (isSqlite) return;

    await queryRunner.query(
      `ALTER TYPE "user_role_enum" ADD VALUE IF NOT EXISTS 'volunteer_manager'`,
    );
    await queryRunner.query(
      `ALTER TYPE "user_role_enum" ADD VALUE IF NOT EXISTS 'guest_manager'`,
    );
    await queryRunner.query(
      `ALTER TYPE "user_role_enum" ADD VALUE IF NOT EXISTS 'host_manager'`,
    );
  }

  async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from an enum without recreating it
  }
}
