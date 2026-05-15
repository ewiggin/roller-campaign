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
import { GuestGroupsService } from './guest-groups.service';
import { CreateGuestGroupDto } from './dto/create-guest-group.dto';
import { UpdateGuestGroupDto } from './dto/update-guest-group.dto';
import { GuestGroupResponseDto } from './dto/guest-group-response.dto';
import { ImportGroupResponseDto } from './dto/import-group-response.dto';
import { SetContactDto } from './dto/set-contact.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

@ApiTags('guest-groups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('guest-groups')
export class GuestGroupsController {
  constructor(private readonly service: GuestGroupsService) {}

  @Get('export')
  @Roles('region_admin')
  @ApiOkResponse({ description: 'Excel con listado de grupos' })
  async exportAll(
    @Query('regionId') regionId: string | undefined,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.service.exportAll(regionId, user);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="grupos.xlsx"',
    });
    res.send(buffer);
  }

  @Get('import/template')
  @Roles('region_admin')
  @ApiOkResponse({ description: 'Plantilla Excel para importación de grupos' })
  getTemplate(@Res() res: Response): void {
    const buffer = this.service.generateTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="plantilla-grupos.xlsx"');
    res.send(buffer);
  }

  @Post('import')
  @Roles('region_admin')
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
    @Query('regionId') regionId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ImportGroupResponseDto> {
    if (!file) throw new Error('No file received');
    return this.service.importFromExcel(file.buffer, regionId, user);
  }

  @Post()
  @Roles('region_admin')
  @ApiCreatedResponse({ type: GuestGroupResponseDto })
  create(@Body() dto: CreateGuestGroupDto, @CurrentUser() user: JwtPayload): Promise<GuestGroupResponseDto> {
    return this.service.create(dto, user);
  }

  @Get()
  @Roles('region_admin')
  @ApiOkResponse({ type: [GuestGroupResponseDto] })
  findAll(
    @Query('regionId') regionId: string | undefined,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 50,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.findAll(regionId, user, page, limit);
  }

  @Get(':id')
  @Roles('region_admin')
  @ApiOkResponse({ type: GuestGroupResponseDto })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<GuestGroupResponseDto> {
    return this.service.findOne(id, user);
  }

  @Patch(':id')
  @Roles('region_admin')
  @ApiOkResponse({ type: GuestGroupResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGuestGroupDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<GuestGroupResponseDto> {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('superadmin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }

  @Patch(':id/host')
  @Roles('region_admin')
  @ApiOkResponse({ type: GuestGroupResponseDto })
  assignHost(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { hostId: string | null },
    @CurrentUser() user: JwtPayload,
  ): Promise<GuestGroupResponseDto> {
    return this.service.assignHost(id, body.hostId ?? null, user);
  }

  @Patch(':id/contact')
  @Roles('region_admin')
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
