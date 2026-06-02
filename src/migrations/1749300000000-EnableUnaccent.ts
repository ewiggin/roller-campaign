import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnableUnaccent1749300000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type === 'postgres') {
      await queryRunner.query('CREATE EXTENSION IF NOT EXISTS unaccent');
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type === 'postgres') {
      await queryRunner.query('DROP EXTENSION IF EXISTS unaccent');
    }
  }
}
