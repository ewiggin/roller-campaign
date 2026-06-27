import { ApiProperty } from '@nestjs/swagger';

export class ImportDatabaseResponseDto {
  @ApiProperty({ description: 'Número de tablas que recibieron datos' })
  tables: number;

  @ApiProperty({ description: 'Número total de filas importadas' })
  rows: number;

  @ApiProperty({
    description: 'Fecha y hora en que se completó la importación',
  })
  importedAt: string;
}
