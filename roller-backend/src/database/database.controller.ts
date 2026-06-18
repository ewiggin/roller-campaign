import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Audit } from '../audit-logs/decorators/audit.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DatabaseService } from './database.service';
import { ImportDatabaseResponseDto } from './dto/import-database-response.dto';

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('superadmin')
@Controller('settings/database')
export class DatabaseController {
  constructor(private readonly databaseService: DatabaseService) {}

  @Get('export')
  @Audit('export', 'settings')
  @ApiOkResponse({ description: 'Volcado completo de la base de datos en JSON' })
  async export(@Res() res: Response): Promise<void> {
    const data = await this.databaseService.exportAll();
    const date = new Date().toISOString().slice(0, 10);
    res.set({
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="roller-backup-${date}.json"`,
    });
    res.send(JSON.stringify(data));
  }

  @Post('import')
  @HttpCode(HttpStatus.OK)
  @Audit('import', 'settings')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOkResponse({ type: ImportDatabaseResponseDto })
  async import(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ImportDatabaseResponseDto> {
    const text = file.buffer.toString('utf-8');
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new BadRequestException('El archivo no contiene JSON válido.');
    }
    return this.databaseService.importAll(data);
  }

  @Post('reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit('reset', 'settings')
  @ApiNoContentResponse({ description: 'Base de datos reiniciada' })
  async reset(): Promise<void> {
    return this.databaseService.resetAll();
  }
}
