import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVolunteerFormFields1747197000000 implements MigrationInterface {
  name = 'AddVolunteerFormFields1747197000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "volunteers" ADD "hosting_address" varchar`);
    await queryRunner.query(`ALTER TABLE "volunteers" ADD "lat" float`);
    await queryRunner.query(`ALTER TABLE "volunteers" ADD "lng" float`);
    await queryRunner.query(`ALTER TABLE "volunteers" ADD "maps_link" varchar`);
    await queryRunner.query(`ALTER TABLE "volunteers" ADD "car_seats" integer`);
    await queryRunner.query(`ALTER TABLE "volunteers" ADD "monday_morning" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "volunteers" ADD "monday_afternoon" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "volunteers" ADD "tuesday_morning" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "volunteers" ADD "tuesday_afternoon" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "volunteers" ADD "wednesday_morning" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "volunteers" ADD "wednesday_afternoon" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "volunteers" ADD "thursday_morning" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "volunteers" ADD "thursday_afternoon" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "volunteers" ADD "friday_morning" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "volunteers" ADD "friday_afternoon" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "volunteers" ADD "saturday_morning" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "volunteers" ADD "saturday_afternoon" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "volunteers" ADD "sunday_morning" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "volunteers" ADD "sunday_afternoon" boolean NOT NULL DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "volunteers" DROP COLUMN "sunday_afternoon"`);
    await queryRunner.query(`ALTER TABLE "volunteers" DROP COLUMN "sunday_morning"`);
    await queryRunner.query(`ALTER TABLE "volunteers" DROP COLUMN "saturday_afternoon"`);
    await queryRunner.query(`ALTER TABLE "volunteers" DROP COLUMN "saturday_morning"`);
    await queryRunner.query(`ALTER TABLE "volunteers" DROP COLUMN "friday_afternoon"`);
    await queryRunner.query(`ALTER TABLE "volunteers" DROP COLUMN "friday_morning"`);
    await queryRunner.query(`ALTER TABLE "volunteers" DROP COLUMN "thursday_afternoon"`);
    await queryRunner.query(`ALTER TABLE "volunteers" DROP COLUMN "thursday_morning"`);
    await queryRunner.query(`ALTER TABLE "volunteers" DROP COLUMN "wednesday_afternoon"`);
    await queryRunner.query(`ALTER TABLE "volunteers" DROP COLUMN "wednesday_morning"`);
    await queryRunner.query(`ALTER TABLE "volunteers" DROP COLUMN "tuesday_afternoon"`);
    await queryRunner.query(`ALTER TABLE "volunteers" DROP COLUMN "tuesday_morning"`);
    await queryRunner.query(`ALTER TABLE "volunteers" DROP COLUMN "monday_afternoon"`);
    await queryRunner.query(`ALTER TABLE "volunteers" DROP COLUMN "monday_morning"`);
    await queryRunner.query(`ALTER TABLE "volunteers" DROP COLUMN "car_seats"`);
    await queryRunner.query(`ALTER TABLE "volunteers" DROP COLUMN "maps_link"`);
    await queryRunner.query(`ALTER TABLE "volunteers" DROP COLUMN "lng"`);
    await queryRunner.query(`ALTER TABLE "volunteers" DROP COLUMN "lat"`);
    await queryRunner.query(`ALTER TABLE "volunteers" DROP COLUMN "hosting_address"`);
  }
}
