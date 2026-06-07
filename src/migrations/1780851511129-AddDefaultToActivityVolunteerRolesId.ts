import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDefaultToActivityVolunteerRolesId1780851511129 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type === 'postgres') {
      await queryRunner.query(
        `ALTER TABLE "activity_volunteer_roles" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()`,
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type === 'postgres') {
      await queryRunner.query(
        `ALTER TABLE "activity_volunteer_roles" ALTER COLUMN "id" DROP DEFAULT`,
      );
    }
  }
}
