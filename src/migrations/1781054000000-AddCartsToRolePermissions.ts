import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCartsToRolePermissions1781054000000 implements MigrationInterface {
  name = 'AddCartsToRolePermissions1781054000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const rows: Array<{ id: number; region_admin: string }> =
      await queryRunner.query(
        `SELECT "id", "region_admin" FROM "role_permissions" WHERE "id" = 1`,
      );

    for (const row of rows) {
      const screens: string[] = JSON.parse(row.region_admin || '[]');
      if (!screens.includes('carts')) {
        screens.push('carts');
        await queryRunner.query(
          `UPDATE "role_permissions" SET "region_admin" = '${JSON.stringify(screens)}' WHERE "id" = ${row.id}`,
        );
      }
    }
  }

  async down(): Promise<void> {
    // No-op: removing 'carts' from existing permission sets is not reversible safely.
  }
}
