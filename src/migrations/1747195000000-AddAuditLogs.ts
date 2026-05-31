import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuditLogs1747195000000 implements MigrationInterface {
  name = 'AddAuditLogs1747195000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "timestamp" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "actor_id" varchar,
        "actor_email" varchar,
        "actor_role" varchar,
        "action" varchar NOT NULL,
        "resource" varchar NOT NULL,
        "resource_id" varchar,
        "ip_address" varchar,
        "user_agent" varchar,
        "metadata" text,
        CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_timestamp" ON "audit_logs" ("timestamp" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_resource" ON "audit_logs" ("resource", "resource_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_actor" ON "audit_logs" ("actor_id")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_actor"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_resource"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_timestamp"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
  }
}
