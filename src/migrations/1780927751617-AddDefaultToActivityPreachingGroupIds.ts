import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDefaultToActivityPreachingGroupIds1780927751617 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type === 'postgres') {
      await queryRunner.query(
        `ALTER TABLE "activity_preaching_groups" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()`,
      );
      await queryRunner.query(
        `ALTER TABLE "activity_preaching_group_volunteers" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()`,
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type === 'postgres') {
      await queryRunner.query(
        `ALTER TABLE "activity_preaching_group_volunteers" ALTER COLUMN "id" DROP DEFAULT`,
      );
      await queryRunner.query(
        `ALTER TABLE "activity_preaching_groups" ALTER COLUMN "id" DROP DEFAULT`,
      );
    }
  }
}
