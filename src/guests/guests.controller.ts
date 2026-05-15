import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreateGuestDto } from './dto/create-guest.dto';
import { GuestListQueryDto } from './dto/guest-list-query.dto';
import { GuestTokenResponseDto } from './dto/guest-me-response.dto';
import { GuestResponseDto } from './dto/guest-response.dto';
import {
  ImportCommitDto,
  ImportCommitResponseDto,
} from './dto/import-commit.dto';
import {
  ImportGuestRowDto,
  ImportParseResponseDto,
} from './dto/import-parse-response.dto';
import { MigrateGuestDto } from './dto/migrate-guest.dto';
import { UpdateGuestDto } from './dto/update-guest.dto';
import { GuestsService } from './guests.service';

@ApiTags('guests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('guests')
export class GuestsController {
  constructor(private readonly service: GuestsService) {}

  @Get('export')
  @Roles('region_admin')
  @ApiOkResponse({ description: 'Excel con listado de invitados' })
  async exportAll(
    @Query() query: GuestListQueryDto,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.service.exportAll(query, user);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="invitados.xlsx"',
    });
    res.send(buffer);
  }

  @Get('import/template')
  @Roles('region_admin')
  @ApiOkResponse({
    description: 'Plantilla Excel para importación de invitados',
  })
  getTemplate(@Res() res: Response): void {
    const buffer = this.service.generateTemplate();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="plantilla-invitados.xlsx"',
    );
    res.send(buffer);
  }

  @Post('import/parse')
  @Roles('region_admin')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        regionId: { type: 'string' },
      },
    },
  })
  @ApiOkResponse({ type: ImportParseResponseDto })
  async parseImport(
    @UploadedFile() file: Express.Multer.File,
    @Query('regionId') regionId: string | undefined,
    @CurrentUser() user: JwtPayload,
  ): Promise<ImportParseResponseDto> {
    if (!file) throw new Error('No se recibió ningún archivo');
    return this.service.parseWithDuplicates(file.buffer, regionId);
  }

  @Post('import/commit')
  @Roles('region_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ImportCommitResponseDto })
  commitImport(
    @Body() dto: ImportCommitDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ImportCommitResponseDto> {
    return this.service.commitImport(dto, user);
  }

  @Post('import/export-not-found')
  @Roles('region_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: 'Excel con filas cuyo grupo no fue encontrado',
  })
  exportNotFound(
    @Body() dto: { rows: ImportGuestRowDto[] },
    @Res() res: Response,
  ): void {
    const buffer = this.service.exportRowsToExcel(dto.rows);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="invitados-sin-grupo.xlsx"',
    );
    res.send(buffer);
  }

  @Post()
  @Roles('region_admin')
  @ApiCreatedResponse({ type: GuestResponseDto })
  create(
    @Body() dto: CreateGuestDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<GuestResponseDto> {
    return this.service.create(dto, user);
  }

  @Get()
  @Roles('region_admin')
  @ApiOkResponse({ description: 'Lista paginada de invitados' })
  findAll(@Query() query: GuestListQueryDto, @CurrentUser() user: JwtPayload) {
    return this.service.findAll(query, user);
  }

  @Get(':id/token')
  @Roles('region_admin')
  @ApiOkResponse({ type: GuestTokenResponseDto })
  generateToken(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<GuestTokenResponseDto> {
    return this.service.generateAccessToken(id, user);
  }

  @Get(':id')
  @Roles('region_admin')
  @ApiOkResponse({ type: GuestResponseDto })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<GuestResponseDto> {
    return this.service.findOne(id, user);
  }

  @Patch(':id')
  @Roles('region_admin')
  @ApiOkResponse({ type: GuestResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGuestDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<GuestResponseDto> {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('superadmin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }

  @Post(':id/migrate')
  @Roles('region_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: GuestResponseDto })
  migrate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MigrateGuestDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<GuestResponseDto> {
    return this.service.migrate(id, dto.targetGroupId, user);
  }
}
