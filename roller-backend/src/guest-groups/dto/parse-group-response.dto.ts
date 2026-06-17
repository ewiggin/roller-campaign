import { ImportGroupRowDto } from './import-group-row.dto';

export class ParseGroupResponseDto {
  valid: ImportGroupRowDto[];
  errors: { row: number; group_code: string; reason: string }[];
  duplicates: string[];
  duplicateRows: ImportGroupRowDto[];
  toDelete: string[];
  summary: {
    total: number;
    valid: number;
    errors: number;
    duplicates: number;
    to_delete: number;
  };
  columns: string[];
}
