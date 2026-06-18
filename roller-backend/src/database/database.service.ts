import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { DataSource, EntityMetadata } from 'typeorm';

export const DATABASE_EXPORT_VERSION = 1;

const INSERT_CHUNK_SIZE = 200;

export interface DatabaseExportTable {
  name: string;
  rows: Record<string, unknown>[];
}

export interface DatabaseExport {
  version: number;
  exportedAt: string;
  tables: DatabaseExportTable[];
}

export interface DatabaseImportSummary {
  tables: number;
  rows: number;
  importedAt: string;
}

@Injectable()
export class DatabaseService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async exportAll(): Promise<DatabaseExport> {
    const tables: DatabaseExportTable[] = [];
    for (const meta of this.getOrderedTables()) {
      const rows = await this.dataSource.query(
        `SELECT * FROM "${meta.tableName}"`,
      );
      tables.push({ name: meta.tableName, rows });
    }
    return {
      version: DATABASE_EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      tables,
    };
  }

  async resetAll(): Promise<void> {
    const ordered = this.getOrderedTables();
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      for (const meta of [...ordered].reverse()) {
        await queryRunner.query(`DELETE FROM "${meta.tableName}"`);
      }
      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
    await this.cache.clear();
  }

  async importAll(data: unknown): Promise<DatabaseImportSummary> {
    if (
      !data ||
      typeof data !== 'object' ||
      !Array.isArray((data as DatabaseExport).tables)
    ) {
      throw new BadRequestException('El archivo de importación no es válido.');
    }
    const dataByTable = new Map<string, Record<string, unknown>[]>();
    for (const table of (data as DatabaseExport).tables) {
      if (!table || typeof table.name !== 'string' || !Array.isArray(table.rows)) {
        throw new BadRequestException(
          'El archivo de importación no es válido.',
        );
      }
      dataByTable.set(table.name, table.rows);
    }

    const ordered = this.getOrderedTables();
    let importedTables = 0;
    let importedRows = 0;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      for (const meta of [...ordered].reverse()) {
        await this.dataSource.query(
          `DELETE FROM "${meta.tableName}"`,
          undefined,
          queryRunner,
        );
      }

      for (const meta of ordered) {
        const rows = dataByTable.get(meta.tableName);
        if (!rows || rows.length === 0) continue;
        const columns = meta.columns
          .map((c) => c.databaseName)
          .filter((name) => Object.prototype.hasOwnProperty.call(rows[0], name));
        if (columns.length === 0) continue;

        for (let i = 0; i < rows.length; i += INSERT_CHUNK_SIZE) {
          const chunk = rows.slice(i, i + INSERT_CHUNK_SIZE);
          const { sql, params } = this.buildInsertQuery(
            meta.tableName,
            columns,
            chunk,
          );
          await this.dataSource.query(sql, params, queryRunner);
          importedRows += chunk.length;
        }
        importedTables += 1;
      }

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    await this.cache.clear();

    return {
      tables: importedTables,
      rows: importedRows,
      importedAt: new Date().toISOString(),
    };
  }

  /**
   * Returns table metadata ordered so that referenced (parent) tables always
   * come before tables that hold a foreign key to them. Junction tables for
   * many-to-many relations are included after both sides they connect.
   */
  private getOrderedTables(): EntityMetadata[] {
    const byName = new Map<string, EntityMetadata>();
    const normalize = (path: string) => path.split('.').pop()!;

    for (const meta of this.dataSource.entityMetadatas) {
      byName.set(meta.tableName, meta);
      for (const relation of meta.manyToManyRelations) {
        if (relation.isManyToManyOwner && relation.junctionEntityMetadata) {
          byName.set(
            relation.junctionEntityMetadata.tableName,
            relation.junctionEntityMetadata,
          );
        }
      }
    }

    const visited = new Set<string>();
    const ordered: EntityMetadata[] = [];
    const visit = (meta: EntityMetadata) => {
      if (visited.has(meta.tableName)) return;
      visited.add(meta.tableName);
      for (const fk of meta.foreignKeys) {
        const refName = normalize(fk.referencedTablePath);
        if (refName === meta.tableName) continue;
        const dep = byName.get(refName);
        if (dep) visit(dep);
      }
      ordered.push(meta);
    };
    for (const meta of byName.values()) visit(meta);
    return ordered;
  }

  private buildInsertQuery(
    tableName: string,
    columns: string[],
    rows: Record<string, unknown>[],
  ): { sql: string; params: unknown[] } {
    const isPostgres = this.dataSource.options.type === 'postgres';
    const params: unknown[] = [];
    const valueRows = rows.map((row) => {
      const placeholders = columns.map((col) => {
        const v = row[col] ?? null;
        params.push(typeof v === 'boolean' ? (v ? 1 : 0) : v);
        return isPostgres ? `$${params.length}` : '?';
      });
      return `(${placeholders.join(', ')})`;
    });
    const columnList = columns.map((c) => `"${c}"`).join(', ');
    const sql = `INSERT INTO "${tableName}" (${columnList}) VALUES ${valueRows.join(', ')}`;
    return { sql, params };
  }
}
