import { randomUUID } from 'crypto';
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddActivityPreachingGroups1780852876285 implements MigrationInterface {
  name = 'AddActivityPreachingGroups1780852876285';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "activity_preaching_groups" (
        "id" uuid NOT NULL,
        "activity_id" uuid NOT NULL,
        "name" varchar DEFAULT NULL,
        "position" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_activity_preaching_groups" PRIMARY KEY ("id"),
        CONSTRAINT "FK_apg_activity" FOREIGN KEY ("activity_id")
          REFERENCES "activities"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "activity_preaching_group_volunteers" (
        "id" uuid NOT NULL,
        "preaching_group_id" uuid NOT NULL,
        "volunteer_id" uuid NOT NULL,
        "description" varchar DEFAULT NULL,
        CONSTRAINT "PK_activity_preaching_group_volunteers" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_apgv_group_volunteer" UNIQUE ("preaching_group_id", "volunteer_id"),
        CONSTRAINT "FK_apgv_group" FOREIGN KEY ("preaching_group_id")
          REFERENCES "activity_preaching_groups"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_apgv_volunteer" FOREIGN KEY ("volunteer_id")
          REFERENCES "volunteers"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "activity_preaching_group_guest_groups" (
        "preachingGroupId" uuid NOT NULL,
        "guestGroupId" uuid NOT NULL,
        CONSTRAINT "PK_activity_preaching_group_guest_groups" PRIMARY KEY ("preachingGroupId", "guestGroupId"),
        CONSTRAINT "FK_apggg_group" FOREIGN KEY ("preachingGroupId")
          REFERENCES "activity_preaching_groups"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_apggg_guest_group" FOREIGN KEY ("guestGroupId")
          REFERENCES "guest_groups"("id") ON DELETE CASCADE
      )
    `);

    await this.backfillDefaultGroups(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "activity_preaching_group_guest_groups"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "activity_preaching_group_volunteers"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "activity_preaching_groups"`);
  }

  // Bundles the volunteers and guest groups already assigned to existing
  // preaching-shift activities into a default "Grupo 1", so nothing is left
  // unorganized once the grouped view ships.
  private async backfillDefaultGroups(queryRunner: QueryRunner): Promise<void> {
    const shifts: { id: string }[] = await queryRunner.query(
      `SELECT id FROM "activities" WHERE "is_preaching_shift" = true`,
    );

    for (const shift of shifts) {
      const volunteers: { volunteersId: string }[] = await queryRunner.query(
        `SELECT "volunteersId" FROM "activity_volunteers" WHERE "activitiesId" = '${shift.id}'`,
      );
      const guestGroups: { guestGroupId: string }[] = await queryRunner.query(
        `SELECT "guestGroupId" FROM "activity_guest_groups" WHERE "activityId" = '${shift.id}'`,
      );
      if (volunteers.length === 0 && guestGroups.length === 0) continue;

      // UUIDs are alphanumeric-safe for interpolation
      const groupId = randomUUID();
      await queryRunner.query(`
        INSERT INTO "activity_preaching_groups" ("id", "activity_id", "name", "position")
        VALUES ('${groupId}', '${shift.id}', 'Grupo 1', 0)
      `);

      for (const v of volunteers) {
        await queryRunner.query(`
          INSERT INTO "activity_preaching_group_volunteers" ("id", "preaching_group_id", "volunteer_id")
          VALUES ('${randomUUID()}', '${groupId}', '${v.volunteersId}')
        `);
      }
      for (const g of guestGroups) {
        await queryRunner.query(`
          INSERT INTO "activity_preaching_group_guest_groups" ("preachingGroupId", "guestGroupId")
          VALUES ('${groupId}', '${g.guestGroupId}')
        `);
      }
    }
  }
}
