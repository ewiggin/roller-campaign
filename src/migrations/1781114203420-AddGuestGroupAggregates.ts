import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  computeGroupAggregates,
  GuestAggregateInput,
} from '../guest-groups/aggregates';

/**
 * Phase 1 of the guest data removal plan: snapshot the guest aggregates onto
 * guest_groups so they survive the future deletion of the guests table.
 * The backfill runs once here; the recompute endpoint can refresh it later.
 */
export class AddGuestGroupAggregates1781114203420 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "guest_groups" ADD COLUMN IF NOT EXISTS "agg_guest_count" integer DEFAULT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "guest_groups" ADD COLUMN IF NOT EXISTS "agg_minor_count" integer DEFAULT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "guest_groups" ADD COLUMN IF NOT EXISTS "agg_status_counts" text DEFAULT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "guest_groups" ADD COLUMN IF NOT EXISTS "agg_avg_lat" double precision DEFAULT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "guest_groups" ADD COLUMN IF NOT EXISTS "agg_avg_lng" double precision DEFAULT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "guest_groups" ADD COLUMN IF NOT EXISTS "agg_languages" text DEFAULT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "guest_groups" ADD COLUMN IF NOT EXISTS "agg_speaks_english" boolean DEFAULT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "guest_groups" ADD COLUMN IF NOT EXISTS "agg_car_seats" integer DEFAULT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "guest_groups" ADD COLUMN IF NOT EXISTS "agg_computed_at" varchar DEFAULT NULL`,
    );

    // ── Backfill from the still-existing guests table ─────────────────────
    const groupRows: { id: string }[] = await queryRunner.query(
      `SELECT id FROM guest_groups`,
    );
    const guestRows: (GuestAggregateInput & { group_id: string })[] =
      await queryRunner.query(
        `SELECT group_id, status, is_minor, lat, lng, native_language, other_languages, speaks_english, car_seats FROM guests`,
      );

    const guestsByGroup = new Map<string, GuestAggregateInput[]>();
    for (const row of guestRows) {
      const list = guestsByGroup.get(row.group_id) ?? [];
      list.push(row);
      guestsByGroup.set(row.group_id, list);
    }

    const computedAt = new Date().toISOString();
    for (const group of groupRows) {
      const agg = computeGroupAggregates(guestsByGroup.get(group.id) ?? []);
      await queryRunner.query(
        `UPDATE guest_groups SET
           agg_guest_count = $1,
           agg_minor_count = $2,
           agg_status_counts = $3,
           agg_avg_lat = $4,
           agg_avg_lng = $5,
           agg_languages = $6,
           agg_speaks_english = $7,
           agg_car_seats = $8,
           agg_computed_at = $9
         WHERE id = $10`,
        [
          agg.agg_guest_count,
          agg.agg_minor_count,
          JSON.stringify(agg.agg_status_counts),
          agg.agg_avg_lat,
          agg.agg_avg_lng,
          agg.agg_languages.length > 0 ? agg.agg_languages.join(',') : null,
          agg.agg_speaks_english,
          agg.agg_car_seats,
          computedAt,
          group.id,
        ],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "guest_groups" DROP COLUMN IF EXISTS "agg_computed_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "guest_groups" DROP COLUMN IF EXISTS "agg_car_seats"`,
    );
    await queryRunner.query(
      `ALTER TABLE "guest_groups" DROP COLUMN IF EXISTS "agg_speaks_english"`,
    );
    await queryRunner.query(
      `ALTER TABLE "guest_groups" DROP COLUMN IF EXISTS "agg_languages"`,
    );
    await queryRunner.query(
      `ALTER TABLE "guest_groups" DROP COLUMN IF EXISTS "agg_avg_lng"`,
    );
    await queryRunner.query(
      `ALTER TABLE "guest_groups" DROP COLUMN IF EXISTS "agg_avg_lat"`,
    );
    await queryRunner.query(
      `ALTER TABLE "guest_groups" DROP COLUMN IF EXISTS "agg_status_counts"`,
    );
    await queryRunner.query(
      `ALTER TABLE "guest_groups" DROP COLUMN IF EXISTS "agg_minor_count"`,
    );
    await queryRunner.query(
      `ALTER TABLE "guest_groups" DROP COLUMN IF EXISTS "agg_guest_count"`,
    );
  }
}
