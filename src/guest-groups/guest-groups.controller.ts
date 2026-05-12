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
import { GuestGroupsService } from './guest-groups.service';
import { CreateGuestGroupDto } from './dto/create-guest-group.dto';
import { UpdateGuestGroupDto } from './dto/update-guest-group.dto';
import { GuestGroupResponseDto } from './dto/guest-group-response.dto';
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
    @CurrentUser() user: JwtPayload,
  ): Promise<GuestGroupResponseDto[]> {
    return this.service.findAll(regionId, user);
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
