import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddActivitySeriesId1747197000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "series_id" varchar DEFAULT NULL`);
    await queryRunner.query(`ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "name" varchar NOT NULL DEFAULT ''`);
    await queryRunner.query(`ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "icon" varchar DEFAULT NULL`);
    await queryRunner.query(`ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "host_id" uuid DEFAULT NULL`);

    // AddActivityLocation (1747193) added lat/lng but entity uses activity_lat/activity_lng
    // Rename if the old columns exist, otherwise add with the correct names
    const cols = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'activities' AND column_name IN ('lat','lng','activity_lat','activity_lng')
    `);
    const colNames: string[] = cols.map((r: { column_name: string }) => r.column_name);

    if (colNames.includes('lat') && !colNames.includes('activity_lat')) {
      await queryRunner.query(`ALTER TABLE "activities" RENAME COLUMN "lat" TO "activity_lat"`);
    } else if (!colNames.includes('activity_lat')) {
      await queryRunner.query(`ALTER TABLE "activities" ADD COLUMN "activity_lat" double precision DEFAULT NULL`);
    }

    if (colNames.includes('lng') && !colNames.includes('activity_lng')) {
      await queryRunner.query(`ALTER TABLE "activities" RENAME COLUMN "lng" TO "activity_lng"`);
    } else if (!colNames.includes('activity_lng')) {
      await queryRunner.query(`ALTER TABLE "activities" ADD COLUMN "activity_lng" double precision DEFAULT NULL`);
    }

    await queryRunner.query(`ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "activity_address" varchar DEFAULT NULL`);
    await queryRunner.query(`ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "departure_address" varchar DEFAULT NULL`);
    await queryRunner.query(`ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "departure_lat" double precision DEFAULT NULL`);
    await queryRunner.query(`ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "departure_lng" double precision DEFAULT NULL`);

    // Add FK to hosts if not already present
    const fkExists = await queryRunner.query(`
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_name = 'activities' AND constraint_name = 'FK_activities_host'
    `);
    if (!fkExists.length) {
      await queryRunner.query(`
        ALTER TABLE "activities"
          ADD CONSTRAINT "FK_activities_host"
          FOREIGN KEY ("host_id") REFERENCES "hosts"("id") ON DELETE SET NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "activities" DROP CONSTRAINT IF EXISTS "FK_activities_host"`);
    await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN IF EXISTS "departure_lng"`);
    await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN IF EXISTS "departure_lat"`);
    await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN IF EXISTS "departure_address"`);
    await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN IF EXISTS "activity_address"`);
    await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN IF EXISTS "activity_lng"`);
    await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN IF EXISTS "activity_lat"`);
    await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN IF EXISTS "host_id"`);
    await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN IF EXISTS "icon"`);
    await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN IF EXISTS "name"`);
    await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN IF EXISTS "series_id"`);
  }
}
