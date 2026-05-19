import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGroupAvailabilityAndComposition1747196000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "guest_groups" ADD COLUMN "available_from" varchar DEFAULT NULL`);
    await queryRunner.query(`ALTER TABLE "guest_groups" ADD COLUMN "available_to" varchar DEFAULT NULL`);
    await queryRunner.query(`ALTER TABLE "guest_groups" ADD COLUMN "composition" varchar DEFAULT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "guest_groups" DROP COLUMN "composition"`);
    await queryRunner.query(`ALTER TABLE "guest_groups" DROP COLUMN "available_to"`);
    await queryRunner.query(`ALTER TABLE "guest_groups" DROP COLUMN "available_from"`);
  }
}
