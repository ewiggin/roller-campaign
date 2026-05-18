import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGuestTermsAccepted1747194000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "guests" ADD COLUMN "terms_accepted" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "guests" ADD COLUMN "terms_accepted_at" varchar DEFAULT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "guests" ADD COLUMN "terms_version" varchar DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "guests" DROP COLUMN "terms_version"`);
    await queryRunner.query(
      `ALTER TABLE "guests" DROP COLUMN "terms_accepted_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "guests" DROP COLUMN "terms_accepted"`,
    );
  }
}
