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
  Put,
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
import { VolunteersService } from './volunteers.service';
import { CreateVolunteerDto } from './dto/create-volunteer.dto';
import { UpdateVolunteerDto } from './dto/update-volunteer.dto';
import { VolunteerListQueryDto } from './dto/volunteer-list-query.dto';
import { VolunteerResponseDto, VolunteerRoleDto, AvailabilityEntryDto } from './dto/volunteer-response.dto';
import {
  SetAvailabilityDto,
  CreateRoleDto,
  ImportVolunteerParseResponseDto,
  ImportVolunteerCommitDto,
  ImportVolunteerCommitResponseDto,
} from './dto/set-availability.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Audit } from '../audit-logs/decorators/audit.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

@ApiTags('volunteers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('volunteers')
export class VolunteersController {
  constructor(private readonly svc: VolunteersService) {}

  // ── Roles ──────────────────────────────────────────────────────────────────

  @Get('roles')
  @Roles('region_admin')
  @ApiOkResponse({ type: [VolunteerRoleDto] })
  findAllRoles(): Promise<VolunteerRoleDto[]> {
    return this.svc.findAllRoles();
  }

  @Post('roles')
  @Roles('region_admin')
  @ApiCreatedResponse({ type: VolunteerRoleDto })
  createRole(@Body() dto: CreateRoleDto): Promise<VolunteerRoleDto> {
    return this.svc.createRole(dto);
  }

  @Delete('roles/:id')
  @Roles('superadmin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  deleteRole(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.svc.deleteRole(id);
  }

  // ── Import ─────────────────────────────────────────────────────────────────

  @Get('import/template')
  @Roles('region_admin')
  getTemplate(@Res() res: Response): void {
    const buf = this.svc.generateTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="plantilla-voluntarios.xlsx"');
    res.send(buf);
  }

  @Post('import/parse')
  @Roles('region_admin')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOkResponse({ type: ImportVolunteerParseResponseDto })
  async parseImport(@UploadedFile() file: Express.Multer.File): Promise<ImportVolunteerParseResponseDto> {
    return this.svc.parseImport(file.buffer);
  }

  @Post('import/commit')
  @Roles('region_admin')
  @Audit('import', 'volunteer')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ImportVolunteerCommitResponseDto })
  commitImport(@Body() dto: ImportVolunteerCommitDto): Promise<ImportVolunteerCommitResponseDto> {
    return this.svc.commitImport(dto);
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  @Post()
  @Roles('region_admin')
  @Audit('create', 'volunteer')
  @ApiCreatedResponse({ type: VolunteerResponseDto })
  create(@Body() dto: CreateVolunteerDto, @CurrentUser() user: JwtPayload): Promise<VolunteerResponseDto> {
    return this.svc.create(dto, user);
  }

  // ── Me (volunteer self-service) ────────────────────────────────────────────

  @Get('me')
  @Roles('volunteer')
  @ApiOkResponse({ type: VolunteerResponseDto })
  getMe(@CurrentUser() user: JwtPayload): Promise<VolunteerResponseDto> {
    return this.svc.getMe(user);
  }

  @Get('me/availability')
  @Roles('volunteer')
  @ApiOkResponse({ type: [AvailabilityEntryDto] })
  getMyAvailability(@CurrentUser() user: JwtPayload): Promise<AvailabilityEntryDto[]> {
    return this.svc.getMyAvailability(user);
  }

  @Put('me/availability')
  @Roles('volunteer')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: [AvailabilityEntryDto] })
  setMyAvailability(
    @Body() dto: SetAvailabilityDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<AvailabilityEntryDto[]> {
    return this.svc.setMyAvailability(user, dto);
  }

  @Get()
  @Roles('region_admin')
  @Audit('list', 'volunteer')
  @ApiOkResponse({ description: 'Lista paginada de voluntarios' })
  findAll(@Query() query: VolunteerListQueryDto, @CurrentUser() user: JwtPayload) {
    return this.svc.findAll(query, user);
  }

  @Get(':id')
  @Roles('region_admin')
  @Audit('read', 'volunteer')
  @ApiOkResponse({ type: VolunteerResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload): Promise<VolunteerResponseDto> {
    return this.svc.findOne(id, user);
  }

  @Patch(':id')
  @Roles('region_admin')
  @Audit('update', 'volunteer')
  @ApiOkResponse({ type: VolunteerResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVolunteerDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<VolunteerResponseDto> {
    return this.svc.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('superadmin')
  @Audit('delete', 'volunteer')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.svc.remove(id);
  }

  // ── Availability ───────────────────────────────────────────────────────────

  @Put(':id/availability')
  @Roles('region_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: [AvailabilityEntryDto] })
  setAvailability(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetAvailabilityDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<AvailabilityEntryDto[]> {
    return this.svc.setAvailability(id, dto, user);
  }

  @Get(':id/availability')
  @Roles('region_admin')
  @ApiOkResponse({ type: [AvailabilityEntryDto] })
  getAvailability(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<AvailabilityEntryDto[]> {
    return this.svc.getAvailability(id, user);
  }
}
