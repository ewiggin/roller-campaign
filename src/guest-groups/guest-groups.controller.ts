import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
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
import { Audit } from '../audit-logs/decorators/audit.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreateGuestGroupDto } from './dto/create-guest-group.dto';
import { GuestGroupResponseDto } from './dto/guest-group-response.dto';
import { ImportGroupResponseDto } from './dto/import-group-response.dto';
import { RecomputeAggregatesResponseDto } from './dto/recompute-aggregates-response.dto';
import { SetContactDto } from './dto/set-contact.dto';
import { UpdateGuestGroupDto } from './dto/update-guest-group.dto';
import { GuestGroupsService } from './guest-groups.service';

@ApiTags('guest-groups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('guest-groups')
export class GuestGroupsController {
  constructor(private readonly service: GuestGroupsService) {}

  @Get('export')
  @ApiOkResponse({ description: 'Excel con listado de grupos' })
  async exportAll(
    @Query('regionId') regionId: string | undefined,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.service.exportAll(regionId, user);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="grupos.xlsx"',
    });
    res.send(buffer);
  }

  @Get('import/template')
  @ApiOkResponse({ description: 'Plantilla Excel para importación de grupos' })
  getTemplate(@Res() res: Response): void {
    const buffer = this.service.generateTemplate();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="plantilla-grupos.xlsx"',
    );
    res.send(buffer);
  }

  @Post('import')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOkResponse({ type: ImportGroupResponseDto })
  async importGroups(
    @UploadedFile() file: Express.Multer.File,
    @Query('regionId') regionId: string | undefined,
    @Query('deleteAbsent') deleteAbsent: string | undefined,
    @CurrentUser() user: JwtPayload,
  ): Promise<ImportGroupResponseDto> {
    if (!file) throw new Error('No file received');
    return this.service.importFromExcel(
      file.buffer,
      regionId,
      user,
      deleteAbsent === 'true',
    );
  }

  @Post()
  @ApiCreatedResponse({ type: GuestGroupResponseDto })
  create(
    @Body() dto: CreateGuestGroupDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<GuestGroupResponseDto> {
    return this.service.create(dto, user);
  }

  @Get()
  @ApiOkResponse({
    description: 'Paginated list of guest groups with available filter options',
  })
  findAll(
    @Query('regionId') regionId: string | undefined,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 50,
    @Query('search') search: string | undefined,
    @Query('minCarSeats', new ParseIntPipe({ optional: true }))
    minCarSeats: number | undefined,
    @Query('languages') languagesRaw: string | undefined,
    @Query('compositions') compositionsRaw: string | undefined,
    @Query('hasCars') hasCarsRaw: string | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    const languages = languagesRaw
      ? languagesRaw.split(',').filter(Boolean)
      : [];
    const compositions = compositionsRaw
      ? compositionsRaw.split(',').filter(Boolean)
      : [];
    const hasCars =
      hasCarsRaw === 'true' ? true : hasCarsRaw === 'false' ? false : undefined;
    return this.service.findAll(
      regionId,
      user,
      page,
      limit,
      search,
      minCarSeats,
      languages,
      compositions,
      hasCars,
    );
  }

  @Get(':id')
  @ApiOkResponse({ type: GuestGroupResponseDto })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<GuestGroupResponseDto> {
    return this.service.findOne(id, user);
  }

  @Patch(':id')
  @ApiOkResponse({ type: GuestGroupResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGuestGroupDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<GuestGroupResponseDto> {
    return this.service.update(id, dto, user);
  }

  @Post('recompute-aggregates')
  @Audit('update', 'guest_group')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: RecomputeAggregatesResponseDto })
  recomputeAggregates(): Promise<RecomputeAggregatesResponseDto> {
    return this.service.recomputeAggregates();
  }

  @Delete('truncate')
  @Audit('truncate', 'guest_group')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Deleted guests and guest-groups counts' })
  truncate(): Promise<{ deleted_guests: number; deleted_groups: number }> {
    return this.service.truncate();
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }

  @Patch(':id/host')
  @ApiOkResponse({ type: GuestGroupResponseDto })
  assignHost(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { hostId: string | null },
    @CurrentUser() user: JwtPayload,
  ): Promise<GuestGroupResponseDto> {
    return this.service.assignHost(id, body.hostId ?? null, user);
  }

  @Patch(':id/contact')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  setContact(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetContactDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.service.setContact(id, dto.guestId, user);
  }
}
