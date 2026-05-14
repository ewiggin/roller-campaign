import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddActivityGroupsAndStatus1747192000000 implements MigrationInterface {
  name = 'AddActivityGroupsAndStatus1747192000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "activities"
        ADD COLUMN IF NOT EXISTS "status" varchar NOT NULL DEFAULT 'draft'
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "activity_guest_groups" (
        "activityId" uuid NOT NULL,
        "guestGroupId" uuid NOT NULL,
        CONSTRAINT "PK_activity_guest_groups" PRIMARY KEY ("activityId", "guestGroupId"),
        CONSTRAINT "FK_agg_activity" FOREIGN KEY ("activityId")
          REFERENCES "activities"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_agg_guest_group" FOREIGN KEY ("guestGroupId")
          REFERENCES "guest_groups"("id") ON DELETE CASCADE
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "activity_guest_groups"`);
    await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN IF EXISTS "status"`);
  }
}
