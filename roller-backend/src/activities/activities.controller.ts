import {
  BadRequestException,
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
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { ActivitiesService } from './activities.service';
import { AssignGuestGroupDto } from './dto/assign-guest-group.dto';
import { AssignVolunteerDto } from './dto/assign-volunteer.dto';
import { SetVolunteerRoleDto } from './dto/set-volunteer-role.dto';
import {
  CreatePreachingGroupDto,
  UpdatePreachingGroupDto,
} from './dto/preaching-group.dto';
import {
  AssignGroupVolunteerDto,
  UpdateGroupVolunteerDescriptionDto,
} from './dto/assign-group-volunteer.dto';
import { AssignGroupGuestGroupDto } from './dto/assign-group-guest-group.dto';
import { AssignGroupCartDto } from './dto/assign-group-cart.dto';
import { ActivityListQueryDto } from './dto/activity-list-query.dto';
import {
  ActivityResponseDto,
  AvailableCartForActivityDto,
  AvailableGroupForActivityDto,
  AvailableVolunteerForActivityDto,
} from './dto/activity-response.dto';
import { CreateActivityBatchDto } from './dto/create-activity-batch.dto';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';

@ApiTags('activities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('activities')
export class ActivitiesController {
  constructor(private readonly svc: ActivitiesService) {}

  @Post()
  @ApiCreatedResponse({ type: ActivityResponseDto })
  create(
    @Body() dto: CreateActivityDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ActivityResponseDto> {
    return this.svc.create(dto, user);
  }

  @Post('batch')
  @ApiCreatedResponse({ type: [ActivityResponseDto] })
  createBatch(
    @Body() dto: CreateActivityBatchDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ActivityResponseDto[]> {
    return this.svc.createBatch(dto, user);
  }

  @Get()
  @ApiOkResponse({ description: 'Lista paginada de actividades' })
  findAll(
    @Query() query: ActivityListQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.svc.findAll(query, user);
  }

  @Get('volunteer-schedule')
  @ApiOkResponse({
    description: 'JSON con el calendario de actividades de un voluntario',
  })
  getVolunteerSchedule(
    @Query('volunteerId') volunteerId: string | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!volunteerId)
      throw new BadRequestException('volunteerId es obligatorio');
    return this.svc.getVolunteerScheduleJson(volunteerId, user);
  }

  @Get('group-schedule')
  @ApiOkResponse({
    description: 'JSON con el calendario de actividades de un grupo',
  })
  getGroupSchedule(
    @Query('groupId') groupId: string | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!groupId) throw new BadRequestException('groupId es obligatorio');
    return this.svc.getGroupScheduleJson(groupId, user);
  }

  @Get('export/schedule-pdf')
  @ApiOkResponse({
    description:
      'PDF con el calendario de actividades y turnos de predicación. ' +
      'Usar groupId para un grupo concreto, hostId para todos los grupos ' +
      'de una congregación (una página por grupo), o volunteerId para un voluntario.',
  })
  async exportSchedulePdf(
    @Query('groupId') groupId: string | undefined,
    @Query('hostId') hostId: string | undefined,
    @Query('volunteerId') volunteerId: string | undefined,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ): Promise<void> {
    if (!groupId && !hostId && !volunteerId) {
      throw new BadRequestException(
        'groupId, hostId o volunteerId es obligatorio',
      );
    }

    let buffer: Buffer;
    let filename: string;

    if (groupId) {
      ({ buffer, filename } = await this.svc.exportGroupSchedulePdf(
        groupId,
        user,
      ));
    } else if (volunteerId) {
      ({ buffer, filename } = await this.svc.exportVolunteerSchedulePdf(
        volunteerId,
        user,
      ));
    } else {
      ({ buffer, filename } = await this.svc.exportHostSchedulesPdf(
        hostId!,
        user,
      ));
    }

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(buffer);
  }

  @Get('export/group-schedules-zip')
  @ApiOkResponse({
    description: 'ZIP with individual schedule PDFs for each filtered group',
  })
  async exportGroupSchedulesZip(
    @Query('regionId') regionId: string | undefined,
    @Query('search') search: string | undefined,
    @Query('hostId') hostId: string | undefined,
    @Query('noHost') noHost: string | undefined,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ): Promise<void> {
    if (!regionId) throw new BadRequestException('regionId is required');
    const buffer = await this.svc.exportGroupSchedulesZip(
      {
        regionId,
        search: search || undefined,
        hostId: hostId || undefined,
        noHost: noHost === 'true' ? true : undefined,
      },
      user,
    );
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="calendarios-grupos.zip"',
    });
    res.send(buffer);
  }

  // ── Excel import / export ─────────────────────────────────────────────────

  @Get('import/template')
  @ApiOkResponse({
    description: 'Plantilla Excel para importación de actividades',
  })
  getImportTemplate(
    @Query('is_preaching_shift') isPreachingShift: string | undefined,
    @Query('is_food_shift') isFoodShift: string | undefined,
    @Res() res: Response,
  ): void {
    const ps = isPreachingShift === 'true';
    const fs = isFoodShift === 'true';
    const buffer = this.svc.generateExcelTemplate(ps, fs);
    const filename = ps
      ? 'plantilla-turnos-predicacion.xlsx'
      : fs
        ? 'plantilla-turnos-comida.xlsx'
        : 'plantilla-actividades.xlsx';
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(buffer);
  }

  @Get('export/excel')
  @ApiOkResponse({ description: 'Excel con listado de actividades' })
  async exportExcel(
    @Query() query: ActivityListQueryDto,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.svc.exportActivitiesToExcel(query, user);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="actividades.xlsx"',
    });
    res.send(buffer);
  }

  @Post('import/parse-excel')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOkResponse({ description: 'Actividades parseadas del Excel' })
  async parseExcelImport(
    @UploadedFile() file: Express.Multer.File,
    @Query('is_preaching_shift') isPreachingShift: string | undefined,
    @Query('is_food_shift') isFoodShift: string | undefined,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ activities: ActivityResponseDto[]; errors: string[] }> {
    if (!file) throw new BadRequestException('No se recibió ningún archivo');
    return this.svc.parseExcelImport(
      file.buffer,
      user,
      isPreachingShift === 'true',
      isFoodShift === 'true',
    );
  }

  @Post('preaching-groups/bulk-auto-assign')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description:
      '{ shiftsProcessed, totalSkipped, unassignedGroups: { id, group_code, guest_count }[] }',
  })
  bulkAutoAssignGuestGroupsToPreachingGroups(
    @CurrentUser() user: JwtPayload,
  ): Promise<{
    shiftsProcessed: number;
    totalSkipped: number;
    unassignedGroups: { id: string; group_code: string; guest_count: number }[];
  }> {
    return this.svc.bulkAutoAssignGuestGroupsToPreachingGroups(user);
  }

  @Post('general/bulk-auto-assign')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: '{ activitiesProcessed: number, totalSkipped: number }',
  })
  bulkAutoAssignNonTypedActivities(
    @CurrentUser() user: JwtPayload,
  ): Promise<{ activitiesProcessed: number; totalSkipped: number }> {
    return this.svc.bulkAutoAssignNonTypedActivities(user);
  }

  @Post('food-shifts/bulk-auto-assign')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description:
      '{ shiftsProcessed, totalSkipped, unassignedGroups: { id, group_code, guest_count }[] }',
  })
  bulkAutoAssignGuestGroupsToFoodShifts(
    @CurrentUser() user: JwtPayload,
  ): Promise<{
    shiftsProcessed: number;
    totalSkipped: number;
    unassignedGroups: { id: string; group_code: string; guest_count: number }[];
  }> {
    return this.svc.bulkAutoAssignGuestGroupsToFoodShifts(user);
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  @Get(':id')
  @ApiOkResponse({ type: ActivityResponseDto })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ActivityResponseDto> {
    return this.svc.findOne(id, user);
  }

  @Patch(':id')
  @ApiOkResponse({ type: ActivityResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateActivityDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ActivityResponseDto> {
    return this.svc.update(id, dto, user);
  }

  @Patch(':id/series-from-here')
  @ApiOkResponse({ type: ActivityResponseDto })
  updateSeriesFromDate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateActivityDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ActivityResponseDto> {
    return this.svc.updateSeriesFromDate(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.svc.remove(id, user);
  }

  @Delete(':id/series-from-here')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'Deletes this activity and all future ones in the same series',
  })
  removeSeriesFromDate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.svc.removeSeriesFromDate(id, user);
  }

  // ── Volunteers ────────────────────────────────────────────────────────────

  @Post(':id/volunteers')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ActivityResponseDto })
  assignVolunteer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignVolunteerDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ActivityResponseDto> {
    return this.svc.assignVolunteer(id, dto.volunteerId, dto.role_id, user);
  }

  @Delete(':id/volunteers/:volunteerId')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ActivityResponseDto })
  unassignVolunteer(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('volunteerId', ParseUUIDPipe) volunteerId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ActivityResponseDto> {
    return this.svc.unassignVolunteer(id, volunteerId, user);
  }

  @Patch(':id/volunteers/:volunteerId/role')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ActivityResponseDto })
  setVolunteerRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('volunteerId', ParseUUIDPipe) volunteerId: string,
    @Body() dto: SetVolunteerRoleDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ActivityResponseDto> {
    return this.svc.setVolunteerRole(id, volunteerId, dto.role_id, user);
  }

  // ── Available volunteers ──────────────────────────────────────────────────

  @Get(':id/available-volunteers')
  @ApiOkResponse({ type: [AvailableVolunteerForActivityDto] })
  getAvailableVolunteers(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<AvailableVolunteerForActivityDto[]> {
    return this.svc.getAvailableVolunteers(id, user);
  }

  // ── Available groups ──────────────────────────────────────────────────────

  @Get(':id/available-groups')
  @ApiOkResponse({ type: [AvailableGroupForActivityDto] })
  getAvailableGroups(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<AvailableGroupForActivityDto[]> {
    return this.svc.getAvailableGroups(id, user);
  }

  // ── Available carts ───────────────────────────────────────────────────────

  @Get(':id/available-carts')
  @ApiOkResponse({ type: [AvailableCartForActivityDto] })
  getAvailableCarts(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<AvailableCartForActivityDto[]> {
    return this.svc.getAvailableCarts(id, user);
  }

  // ── Guest groups ──────────────────────────────────────────────────────────

  @Post(':id/guest-groups')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ActivityResponseDto })
  assignGuestGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignGuestGroupDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ActivityResponseDto> {
    return this.svc.assignGuestGroup(id, dto.groupId, user);
  }

  @Delete(':id/requests/:requestId')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ActivityResponseDto })
  deleteAttendanceRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
  ): Promise<ActivityResponseDto> {
    return this.svc.deleteAttendanceRequest(id, requestId);
  }

  @Delete(':id/guest-groups/:groupId')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ActivityResponseDto })
  unassignGuestGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ActivityResponseDto> {
    return this.svc.unassignGuestGroup(id, groupId, user);
  }

  @Delete(':id/guest-groups')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ActivityResponseDto })
  resetGuestGroups(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ActivityResponseDto> {
    return this.svc.resetGuestGroups(id, user);
  }

  @Delete(':id/volunteers')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ActivityResponseDto })
  resetVolunteers(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ActivityResponseDto> {
    return this.svc.resetVolunteers(id, user);
  }

  // ── Preaching groups ──────────────────────────────────────────────────────

  @Post(':id/preaching-groups/auto-assign')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: '{ activity: ActivityResponseDto, skipped: number }',
  })
  autoAssignGuestGroupsToPreachingGroups(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ activity: ActivityResponseDto; skipped: number }> {
    return this.svc.autoAssignGuestGroupsToPreachingGroups(id, user);
  }

  @Post(':id/food-shift/auto-assign')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: '{ activity: ActivityResponseDto, skipped: number }',
  })
  autoAssignGuestGroupsToFoodShift(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ activity: ActivityResponseDto; skipped: number }> {
    return this.svc.autoAssignGuestGroupsToFoodShift(id, user);
  }

  @Post(':id/general/auto-assign')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: '{ activity: ActivityResponseDto, skipped: number }',
  })
  autoAssignNonTypedActivity(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ activity: ActivityResponseDto; skipped: number }> {
    return this.svc.autoAssignNonTypedActivity(id, user);
  }

  @Post(':id/preaching-groups')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ActivityResponseDto })
  addPreachingGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePreachingGroupDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ActivityResponseDto> {
    return this.svc.addPreachingGroup(id, dto, user);
  }

  @Patch(':id/preaching-groups/:groupId')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ActivityResponseDto })
  updatePreachingGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: UpdatePreachingGroupDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ActivityResponseDto> {
    return this.svc.updatePreachingGroup(id, groupId, dto, user);
  }

  @Delete(':id/preaching-groups/:groupId')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ActivityResponseDto })
  removePreachingGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ActivityResponseDto> {
    return this.svc.removePreachingGroup(id, groupId, user);
  }

  @Post(':id/preaching-groups/:groupId/volunteers')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ActivityResponseDto })
  assignVolunteerToGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: AssignGroupVolunteerDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ActivityResponseDto> {
    return this.svc.assignVolunteerToGroup(id, groupId, dto, user);
  }

  @Patch(':id/preaching-groups/:groupId/volunteers/:volunteerId')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ActivityResponseDto })
  updateGroupVolunteerDescription(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('volunteerId', ParseUUIDPipe) volunteerId: string,
    @Body() dto: UpdateGroupVolunteerDescriptionDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ActivityResponseDto> {
    return this.svc.updateGroupVolunteerDescription(
      id,
      groupId,
      volunteerId,
      dto.description,
      user,
    );
  }

  @Delete(':id/preaching-groups/:groupId/volunteers/:volunteerId')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ActivityResponseDto })
  removeVolunteerFromGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('volunteerId', ParseUUIDPipe) volunteerId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ActivityResponseDto> {
    return this.svc.removeVolunteerFromGroup(id, groupId, volunteerId, user);
  }

  @Post(':id/preaching-groups/:groupId/guest-groups')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ActivityResponseDto })
  assignGuestGroupToGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: AssignGroupGuestGroupDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ActivityResponseDto> {
    return this.svc.assignGuestGroupToGroup(id, groupId, dto.groupId, user);
  }

  @Delete(':id/preaching-groups/:groupId/guest-groups/:guestGroupId')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ActivityResponseDto })
  removeGuestGroupFromGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('guestGroupId', ParseUUIDPipe) guestGroupId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ActivityResponseDto> {
    return this.svc.removeGuestGroupFromGroup(id, groupId, guestGroupId, user);
  }

  @Post(':id/preaching-groups/:groupId/carts')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ActivityResponseDto })
  assignCartToGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: AssignGroupCartDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ActivityResponseDto> {
    return this.svc.assignCartToGroup(id, groupId, dto.cartId, user);
  }

  @Delete(':id/preaching-groups/:groupId/carts/:cartId')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ActivityResponseDto })
  removeCartFromGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('cartId', ParseUUIDPipe) cartId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ActivityResponseDto> {
    return this.svc.removeCartFromGroup(id, groupId, cartId, user);
  }

  // ── Publish ───────────────────────────────────────────────────────────────

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ActivityResponseDto })
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ActivityResponseDto> {
    return this.svc.publish(id, user);
  }

  @Post(':id/unpublish')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ActivityResponseDto })
  unpublish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ActivityResponseDto> {
    return this.svc.unpublish(id, user);
  }
}
