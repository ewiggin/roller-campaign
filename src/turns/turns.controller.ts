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
import { AssignVolunteerDto } from './dto/assign-volunteer.dto';
import { CreateTurnDto } from './dto/create-turn.dto';
import { TurnListQueryDto } from './dto/turn-list-query.dto';
import { TurnResponseDto } from './dto/turn-response.dto';
import { UpdateTurnDto } from './dto/update-turn.dto';
import { TurnsService } from './turns.service';

@ApiTags('turns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('turns')
export class TurnsController {
  constructor(private readonly svc: TurnsService) {}

  @Post()
  @Roles('region_admin')
  @ApiCreatedResponse({ type: TurnResponseDto })
  create(
    @Body() dto: CreateTurnDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<TurnResponseDto> {
    return this.svc.create(dto, user);
  }

  @Get()
  @Roles('region_admin', 'volunteer')
  @ApiOkResponse({ description: 'Lista paginada de turnos' })
  findAll(@Query() query: TurnListQueryDto, @CurrentUser() user: JwtPayload) {
    return this.svc.findAll(query, user);
  }

  @Get(':id')
  @Roles('region_admin')
  @ApiOkResponse({ type: TurnResponseDto })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<TurnResponseDto> {
    return this.svc.findOne(id, user);
  }

  @Patch(':id')
  @Roles('region_admin')
  @ApiOkResponse({ type: TurnResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTurnDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<TurnResponseDto> {
    return this.svc.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('region_admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.svc.remove(id, user);
  }

  @Post(':id/volunteers')
  @Roles('region_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: TurnResponseDto })
  assignVolunteer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignVolunteerDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<TurnResponseDto> {
    return this.svc.assignVolunteer(id, dto.volunteerId, user);
  }

  @Delete(':id/volunteers/:volunteerId')
  @Roles('region_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: TurnResponseDto })
  unassignVolunteer(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('volunteerId', ParseUUIDPipe) volunteerId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<TurnResponseDto> {
    return this.svc.unassignVolunteer(id, volunteerId, user);
  }
}
