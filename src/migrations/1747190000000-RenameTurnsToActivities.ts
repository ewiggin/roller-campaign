import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameTurnsToActivities1747190000000 implements MigrationInterface {
  name = 'RenameTurnsToActivities1747190000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const hasTurns = await queryRunner.query(
      `SELECT to_regclass('public.turns') AS t`,
    );
    if (!hasTurns[0]?.t) return;

    await queryRunner.query(`ALTER TABLE "turn_volunteers" DROP CONSTRAINT IF EXISTS "FK_tv_turn"`);
    await queryRunner.query(`ALTER TABLE "turn_volunteers" DROP CONSTRAINT IF EXISTS "PK_turn_volunteers"`);

    await queryRunner.query(`ALTER TABLE "turn_volunteers" RENAME COLUMN "turnsId" TO "activitiesId"`);
    await queryRunner.query(`ALTER TABLE "turn_volunteers" RENAME TO "activity_volunteers"`);
    await queryRunner.query(`ALTER TABLE "turns" RENAME TO "activities"`);

    await queryRunner.query(`ALTER TABLE "activities" RENAME CONSTRAINT "PK_turns" TO "PK_activities"`);
    await queryRunner.query(`ALTER TABLE "activities" RENAME CONSTRAINT "FK_turns_region" TO "FK_activities_region"`);

    await queryRunner.query(`
      ALTER TABLE "activity_volunteers"
        ADD CONSTRAINT "PK_activity_volunteers" PRIMARY KEY ("activitiesId", "volunteersId")
    `);
    await queryRunner.query(`
      ALTER TABLE "activity_volunteers"
        ADD CONSTRAINT "FK_av_activity" FOREIGN KEY ("activitiesId")
          REFERENCES "activities"("id") ON DELETE CASCADE
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const hasActivities = await queryRunner.query(
      `SELECT to_regclass('public.activities') AS t`,
    );
    if (!hasActivities[0]?.t) return;

    await queryRunner.query(`ALTER TABLE "activity_volunteers" DROP CONSTRAINT IF EXISTS "FK_av_activity"`);
    await queryRunner.query(`ALTER TABLE "activity_volunteers" DROP CONSTRAINT IF EXISTS "PK_activity_volunteers"`);

    await queryRunner.query(`ALTER TABLE "activity_volunteers" RENAME COLUMN "activitiesId" TO "turnsId"`);
    await queryRunner.query(`ALTER TABLE "activity_volunteers" RENAME TO "turn_volunteers"`);
    await queryRunner.query(`ALTER TABLE "activities" RENAME TO "turns"`);

    await queryRunner.query(`ALTER TABLE "turns" RENAME CONSTRAINT "PK_activities" TO "PK_turns"`);
    await queryRunner.query(`ALTER TABLE "turns" RENAME CONSTRAINT "FK_activities_region" TO "FK_turns_region"`);

    await queryRunner.query(`
      ALTER TABLE "turn_volunteers"
        ADD CONSTRAINT "PK_turn_volunteers" PRIMARY KEY ("turnsId", "volunteersId")
    `);
    await queryRunner.query(`
      ALTER TABLE "turn_volunteers"
        ADD CONSTRAINT "FK_tv_turn" FOREIGN KEY ("turnsId")
          REFERENCES "turns"("id") ON DELETE CASCADE
    `);
  }
}
