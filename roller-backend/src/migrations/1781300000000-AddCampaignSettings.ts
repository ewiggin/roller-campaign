import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCampaignSettings1781300000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "campaign_settings" (
        "id"                            integer     NOT NULL,
        "max_activities_per_group"      integer     NOT NULL DEFAULT 4,
        "max_preaching_shifts_per_group" integer    NOT NULL DEFAULT 4,
        "updated_at"                    TIMESTAMP   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_campaign_settings" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      INSERT INTO "campaign_settings" ("id", "max_activities_per_group", "max_preaching_shifts_per_group")
      VALUES (1, 4, 4)
      ON CONFLICT ("id") DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "campaign_settings"`);
  }
}
