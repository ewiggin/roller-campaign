import { MigrationInterface, QueryRunner } from 'typeorm';

export class LocationsToArrays1749500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const isPostgres = queryRunner.connection.options.type === 'postgres';

    await queryRunner.query(
      `ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "activity_locations" text DEFAULT NULL`,
    );

    if (isPostgres) {
      await queryRunner.query(`
        UPDATE activities
        SET activity_locations = json_build_array(
          json_build_object('address', activity_address, 'lat', activity_lat, 'lng', activity_lng)
        )::text
        WHERE activity_address IS NOT NULL AND activity_lat IS NOT NULL AND activity_lng IS NOT NULL
      `);
    } else {
      await queryRunner.query(`
        UPDATE activities
        SET activity_locations = json_array(json_object('address', activity_address, 'lat', activity_lat, 'lng', activity_lng))
        WHERE activity_address IS NOT NULL AND activity_lat IS NOT NULL AND activity_lng IS NOT NULL
      `);
    }

    await queryRunner.query(
      `ALTER TABLE "activities" DROP COLUMN IF EXISTS "activity_address"`,
    );
    await queryRunner.query(
      `ALTER TABLE "activities" DROP COLUMN IF EXISTS "activity_lat"`,
    );
    await queryRunner.query(
      `ALTER TABLE "activities" DROP COLUMN IF EXISTS "activity_lng"`,
    );
    await queryRunner.query(
      `ALTER TABLE "activities" DROP COLUMN IF EXISTS "departure_address"`,
    );
    await queryRunner.query(
      `ALTER TABLE "activities" DROP COLUMN IF EXISTS "departure_lat"`,
    );
    await queryRunner.query(
      `ALTER TABLE "activities" DROP COLUMN IF EXISTS "departure_lng"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "activity_address" varchar DEFAULT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "activity_lat" double precision DEFAULT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "activity_lng" double precision DEFAULT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "departure_address" varchar DEFAULT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "departure_lat" double precision DEFAULT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "departure_lng" double precision DEFAULT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "activities" DROP COLUMN IF EXISTS "activity_locations"`,
    );
  }
}
