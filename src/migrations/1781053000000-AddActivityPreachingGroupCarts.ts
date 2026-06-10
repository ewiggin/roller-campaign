import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddActivityPreachingGroupCarts1781053000000 implements MigrationInterface {
  name = 'AddActivityPreachingGroupCarts1781053000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "activity_preaching_group_carts" (
        "preachingGroupId" uuid NOT NULL,
        "cartId" uuid NOT NULL,
        CONSTRAINT "PK_activity_preaching_group_carts" PRIMARY KEY ("preachingGroupId", "cartId"),
        CONSTRAINT "FK_apgc_group" FOREIGN KEY ("preachingGroupId")
          REFERENCES "activity_preaching_groups"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_apgc_cart" FOREIGN KEY ("cartId")
          REFERENCES "carts"("id") ON DELETE CASCADE
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "activity_preaching_group_carts"`,
    );
  }
}
