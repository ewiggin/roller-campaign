import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddActivitySeriesId1747197000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "activities" ADD COLUMN "series_id" varchar DEFAULT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN "series_id"`);
  }
}
