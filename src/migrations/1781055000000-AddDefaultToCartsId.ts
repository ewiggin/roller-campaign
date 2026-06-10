import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDefaultToCartsId1781055000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type === 'postgres') {
      await queryRunner.query(
        `ALTER TABLE "carts" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()`,
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type === 'postgres') {
      await queryRunner.query(
        `ALTER TABLE "carts" ALTER COLUMN "id" DROP DEFAULT`,
      );
    }
  }
}
