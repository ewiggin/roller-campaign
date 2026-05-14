import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, ParseUUIDPipe, Patch, Post, Query, Res, UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { HostsService } from './hosts.service';
import { CreateHostDto, UpdateHostDto, HostResponseDto, GroupSuggestionsResponseDto } from './dto/host.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

@ApiTags('hosts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('hosts')
export class HostsController {
  constructor(private readonly service: HostsService) {}

  @Post()
  @Roles('region_admin')
  @ApiCreatedResponse({ type: HostResponseDto })
  create(@Body() dto: CreateHostDto, @CurrentUser() user: JwtPayload): Promise<HostResponseDto> {
    return this.service.create(dto, user);
  }

  @Get(':id')
  @Roles('region_admin')
  @ApiOkResponse({ type: HostResponseDto })
  getOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<HostResponseDto> {
    return this.service.getOne(id, user);
  }

  @Get(':id/group-suggestions')
  @Roles('region_admin')
  @ApiOkResponse({ type: GroupSuggestionsResponseDto })
  getGroupSuggestions(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<GroupSuggestionsResponseDto> {
    return this.service.getGroupSuggestions(id, user);
  }

  @Get()
  @Roles('region_admin')
  @ApiOkResponse({ type: [HostResponseDto] })
  findAll(
    @Query('regionId') regionId: string | undefined,
    @CurrentUser() user: JwtPayload,
  ): Promise<HostResponseDto[]> {
    return this.service.findAll(regionId, user);
  }

  @Patch(':id')
  @Roles('region_admin')
  @ApiOkResponse({ type: HostResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateHostDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<HostResponseDto> {
    return this.service.update(id, dto, user);
  }

  @Get(':id/guests/export')
  @Roles('region_admin')
  @ApiOkResponse({ description: 'Excel con invitados asignados al host' })
  async exportGuests(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename } = await this.service.exportGuestsByHost(id, user);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Delete(':id')
  @Roles('superadmin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }
}
