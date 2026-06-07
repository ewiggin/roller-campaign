import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHostNote1780856801501 implements MigrationInterface {
  name = 'AddHostNote1780856801501';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "hosts" ADD COLUMN IF NOT EXISTS "note" varchar`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "hosts" DROP COLUMN IF EXISTS "note"`);
  }
}
