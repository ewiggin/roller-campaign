import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1747180000000 implements MigrationInterface {
  name = 'InitialSchema1747180000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // regions
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "regions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar NOT NULL UNIQUE,
        "event_start_date" varchar,
        "event_end_date" varchar,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_regions" PRIMARY KEY ("id")
      )
    `);

    // users
    await queryRunner.query(`
      CREATE TYPE "user_role_enum" AS ENUM ('superadmin','region_admin','volunteer','guest')
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" varchar NOT NULL UNIQUE,
        "password" varchar NOT NULL,
        "role" "user_role_enum" NOT NULL DEFAULT 'guest',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);

    // region_coordinators join table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "region_coordinators" (
        "regionsId" uuid NOT NULL,
        "usersId" uuid NOT NULL,
        CONSTRAINT "PK_region_coordinators" PRIMARY KEY ("regionsId","usersId"),
        CONSTRAINT "FK_rc_region" FOREIGN KEY ("regionsId") REFERENCES "regions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_rc_user" FOREIGN KEY ("usersId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // hosts
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "hosts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar NOT NULL,
        "region_id" uuid NOT NULL,
        "address" varchar,
        "lat" double precision,
        "lng" double precision,
        "weekday_meeting_day" integer,
        "weekday_meeting_time" varchar,
        "weekend_meeting_day" integer,
        "weekend_meeting_time" varchar,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_hosts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_hosts_region" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE RESTRICT
      )
    `);

    // guest_groups
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "guest_groups" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "group_code" varchar NOT NULL UNIQUE,
        "region_id" uuid NOT NULL,
        "host_id" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_guest_groups" PRIMARY KEY ("id"),
        CONSTRAINT "FK_guest_groups_region" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_guest_groups_host" FOREIGN KEY ("host_id") REFERENCES "hosts"("id") ON DELETE SET NULL
      )
    `);

    // guests
    await queryRunner.query(`
      CREATE TYPE "guest_status_enum" AS ENUM ('pending','confirmed','cancelled','arrived','blocked')
    `);
    await queryRunner.query(`
      CREATE TYPE "transport_mode_enum" AS ENUM ('car','bus','train','plane','ferry','motorbike','other')
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "guests" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "guest_code" varchar NOT NULL UNIQUE,
        "group_id" uuid NOT NULL,
        "region_id" uuid NOT NULL,
        "full_name" varchar NOT NULL,
        "is_minor" boolean NOT NULL DEFAULT false,
        "status" "guest_status_enum" NOT NULL DEFAULT 'pending',
        "branch" varchar,
        "is_group_contact" boolean NOT NULL DEFAULT false,
        "native_language" varchar,
        "other_languages" text,
        "speaks_english" boolean NOT NULL DEFAULT false,
        "is_special_servant" boolean NOT NULL DEFAULT false,
        "origin_city" varchar,
        "email" varchar,
        "available_from" varchar,
        "available_to" varchar,
        "arrival_transport" "transport_mode_enum",
        "arrival_other_transport" varchar,
        "arrival_date" varchar,
        "arrival_time" varchar,
        "arrival_place" varchar,
        "arrival_airport" varchar,
        "arrival_airline" varchar,
        "arrival_flight" varchar,
        "real_arrival" varchar,
        "real_arrival_time" varchar,
        "needs_airport_transfer" boolean NOT NULL DEFAULT false,
        "departure_transport" "transport_mode_enum",
        "departure_other_transport" varchar,
        "departure_date" varchar,
        "departure_time" varchar,
        "departure_place" varchar,
        "departure_airport" varchar,
        "departure_airline" varchar,
        "departure_flight" varchar,
        "real_departure" varchar,
        "real_departure_time" varchar,
        "accommodation" varchar,
        "checkin_date" varchar,
        "checkout_date" varchar,
        "needs_special_accommodation" boolean NOT NULL DEFAULT false,
        "hosting_address" varchar,
        "maps_link" varchar,
        "lat" double precision,
        "lng" double precision,
        "transport_mode" varchar,
        "car_seats" integer,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_guests" PRIMARY KEY ("id"),
        CONSTRAINT "FK_guests_group" FOREIGN KEY ("group_id") REFERENCES "guest_groups"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_guests_region" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE RESTRICT
      )
    `);

    // volunteer_roles
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "volunteer_roles" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar NOT NULL UNIQUE,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_volunteer_roles" PRIMARY KEY ("id")
      )
    `);

    // volunteers
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "volunteers" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "volunteer_code" varchar NOT NULL UNIQUE,
        "full_name" varchar NOT NULL,
        "email" varchar,
        "phone" varchar,
        "is_active" boolean NOT NULL DEFAULT true,
        "user_id" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_volunteers" PRIMARY KEY ("id"),
        CONSTRAINT "FK_volunteers_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    // volunteer_regions join table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "volunteer_regions" (
        "volunteersId" uuid NOT NULL,
        "regionsId" uuid NOT NULL,
        CONSTRAINT "PK_volunteer_regions" PRIMARY KEY ("volunteersId","regionsId"),
        CONSTRAINT "FK_vr_volunteer" FOREIGN KEY ("volunteersId") REFERENCES "volunteers"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_vr_region" FOREIGN KEY ("regionsId") REFERENCES "regions"("id") ON DELETE CASCADE
      )
    `);

    // volunteer_role_assignments join table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "volunteer_role_assignments" (
        "volunteersId" uuid NOT NULL,
        "volunteerRolesId" uuid NOT NULL,
        CONSTRAINT "PK_vra" PRIMARY KEY ("volunteersId","volunteerRolesId"),
        CONSTRAINT "FK_vra_volunteer" FOREIGN KEY ("volunteersId") REFERENCES "volunteers"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_vra_role" FOREIGN KEY ("volunteerRolesId") REFERENCES "volunteer_roles"("id") ON DELETE CASCADE
      )
    `);

    // volunteer_availability
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "volunteer_availability" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "volunteer_id" uuid NOT NULL,
        "region_id" uuid NOT NULL,
        "date" varchar NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_volunteer_availability" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_va" UNIQUE ("volunteer_id","region_id","date"),
        CONSTRAINT "FK_va_volunteer" FOREIGN KEY ("volunteer_id") REFERENCES "volunteers"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_va_region" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE CASCADE
      )
    `);

    // turns
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "turns" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "region_id" uuid NOT NULL,
        "date" varchar NOT NULL,
        "start_time" varchar NOT NULL,
        "end_time" varchar NOT NULL,
        "description" varchar,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_turns" PRIMARY KEY ("id"),
        CONSTRAINT "FK_turns_region" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE CASCADE
      )
    `);

    // turn_volunteers join table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "turn_volunteers" (
        "turnsId" uuid NOT NULL,
        "volunteersId" uuid NOT NULL,
        CONSTRAINT "PK_turn_volunteers" PRIMARY KEY ("turnsId","volunteersId"),
        CONSTRAINT "FK_tv_turn" FOREIGN KEY ("turnsId") REFERENCES "turns"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_tv_volunteer" FOREIGN KEY ("volunteersId") REFERENCES "volunteers"("id") ON DELETE CASCADE
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "turn_volunteers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "turns"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "volunteer_availability"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "volunteer_role_assignments"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "volunteer_regions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "volunteers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "volunteer_roles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "guests"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "transport_mode_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "guest_status_enum"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "guest_groups"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "hosts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "region_coordinators"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "user_role_enum"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "regions"`);
  }
}
