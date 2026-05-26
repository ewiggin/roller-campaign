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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { ActivitiesService } from './activities.service';
import { AssignGuestGroupDto } from './dto/assign-guest-group.dto';
import { AssignVolunteerDto } from './dto/assign-volunteer.dto';
import { ActivityListQueryDto } from './dto/activity-list-query.dto';
import { ActivityResponseDto, AvailableGroupForActivityDto, AvailableVolunteerForActivityDto } from './dto/activity-response.dto';
import { CreateActivityBatchDto } from './dto/create-activity-batch.dto';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';

@ApiTags('activities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('activities')
export class ActivitiesController {
  constructor(private readonly svc: ActivitiesService) {}

  @Post()
  @Roles('region_admin')
  @ApiCreatedResponse({ type: ActivityResponseDto })
  create(@Body() dto: CreateActivityDto, @CurrentUser() user: JwtPayload): Promise<ActivityResponseDto> {
    return this.svc.create(dto, user);
  }

  @Post('batch')
  @Roles('region_admin')
  @ApiCreatedResponse({ type: [ActivityResponseDto] })
  createBatch(@Body() dto: CreateActivityBatchDto, @CurrentUser() user: JwtPayload): Promise<ActivityResponseDto[]> {
    return this.svc.createBatch(dto, user);
  }

  @Get()
  @Roles('region_admin', 'volunteer')
  @ApiOkResponse({ description: 'Lista paginada de actividades' })
  findAll(@Query() query: ActivityListQueryDto, @CurrentUser() user: JwtPayload) {
    return this.svc.findAll(query, user);
  }

  @Get(':id')
  @Roles('region_admin')
  @ApiOkResponse({ type: ActivityResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload): Promise<ActivityResponseDto> {
    return this.svc.findOne(id, user);
  }

  @Patch(':id')
  @Roles('region_admin')
  @ApiOkResponse({ type: ActivityResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateActivityDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ActivityResponseDto> {
    return this.svc.update(id, dto, user);
  }

  @Patch(':id/series-from-here')
  @Roles('region_admin')
  @ApiOkResponse({ type: ActivityResponseDto })
  updateSeriesFromDate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateActivityDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ActivityResponseDto> {
    return this.svc.updateSeriesFromDate(id, dto, user);
  }

  @Delete(':id')
  @Roles('region_admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload): Promise<void> {
    return this.svc.remove(id, user);
  }

  @Delete(':id/series-from-here')
  @Roles('region_admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Deletes this activity and all future ones in the same series' })
  removeSeriesFromDate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.svc.removeSeriesFromDate(id, user);
  }

  // ── Volunteers ────────────────────────────────────────────────────────────

  @Post(':id/volunteers')
  @Roles('region_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ActivityResponseDto })
  assignVolunteer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignVolunteerDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ActivityResponseDto> {
    return this.svc.assignVolunteer(id, dto.volunteerId, user);
  }

  @Delete(':id/volunteers/:volunteerId')
  @Roles('region_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ActivityResponseDto })
  unassignVolunteer(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('volunteerId', ParseUUIDPipe) volunteerId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ActivityResponseDto> {
    return this.svc.unassignVolunteer(id, volunteerId, user);
  }

  // ── Available volunteers ──────────────────────────────────────────────────

  @Get(':id/available-volunteers')
  @Roles('region_admin')
  @ApiOkResponse({ type: [AvailableVolunteerForActivityDto] })
  getAvailableVolunteers(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<AvailableVolunteerForActivityDto[]> {
    return this.svc.getAvailableVolunteers(id, user);
  }

  // ── Available groups ──────────────────────────────────────────────────────

  @Get(':id/available-groups')
  @Roles('region_admin')
  @ApiOkResponse({ type: [AvailableGroupForActivityDto] })
  getAvailableGroups(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<AvailableGroupForActivityDto[]> {
    return this.svc.getAvailableGroups(id, user);
  }

  // ── Guest groups ──────────────────────────────────────────────────────────

  @Post(':id/guest-groups')
  @Roles('region_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ActivityResponseDto })
  assignGuestGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignGuestGroupDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ActivityResponseDto> {
    return this.svc.assignGuestGroup(id, dto.groupId, user);
  }

  @Delete(':id/guest-groups/:groupId')
  @Roles('region_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ActivityResponseDto })
  unassignGuestGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ActivityResponseDto> {
    return this.svc.unassignGuestGroup(id, groupId, user);
  }

  // ── Publish ───────────────────────────────────────────────────────────────

  @Post(':id/publish')
  @Roles('region_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ActivityResponseDto })
  publish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload): Promise<ActivityResponseDto> {
    return this.svc.publish(id, user);
  }

  @Post(':id/unpublish')
  @Roles('region_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ActivityResponseDto })
  unpublish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload): Promise<ActivityResponseDto> {
    return this.svc.unpublish(id, user);
  }
}
