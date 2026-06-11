import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Patch,
  Put,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  VolunteerCodeTokenResponseDto,
  VolunteerFormLookupResponseDto,
} from './dto/volunteer-form-lookup.dto';
import { VolunteerFormSubmitDto } from './dto/volunteer-form-submit.dto';
import { SetAvailabilityDto } from './dto/set-availability.dto';
import {
  VolunteerActivityDto,
  VolunteerResponseDto,
  AvailabilityEntryDto,
} from './dto/volunteer-response.dto';
import { VolunteersService } from './volunteers.service';

class PublicRegionDto {
  id: string;
  name: string;
}

@ApiTags('volunteer-access')
@Controller('volunteer-access')
export class VolunteerAccessController {
  constructor(private readonly volunteersService: VolunteersService) {}

  @Get('regions')
  @ApiOkResponse({ type: [PublicRegionDto] })
  getRegions(): Promise<PublicRegionDto[]> {
    return this.volunteersService.getPublicRegions();
  }

  @Get('lookup')
  @ApiOkResponse({ type: VolunteerFormLookupResponseDto })
  @ApiNotFoundResponse({ description: 'Código de voluntario no encontrado' })
  lookupByCode(
    @Query('code') code: string,
  ): Promise<VolunteerFormLookupResponseDto> {
    if (!code) throw new NotFoundException('Código requerido');
    return this.volunteersService.lookupByCode(code);
  }

  @Get('token')
  @ApiOkResponse({ type: VolunteerCodeTokenResponseDto })
  @ApiNotFoundResponse({ description: 'Código de voluntario no encontrado' })
  getTokenByCode(
    @Query('code') code: string,
  ): Promise<VolunteerCodeTokenResponseDto> {
    if (!code) throw new NotFoundException('Código requerido');
    return this.volunteersService.getTokenByCode(code);
  }

  @Get('me')
  @ApiOkResponse({ type: VolunteerResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token inválido o expirado' })
  getMe(@Query('token') token: string): Promise<VolunteerResponseDto> {
    if (!token) throw new UnauthorizedException('Token requerido');
    return this.volunteersService.getVolunteerByToken(token);
  }

  @Get('me/availability')
  @ApiOkResponse({ type: [AvailabilityEntryDto] })
  @ApiUnauthorizedResponse({ description: 'Token inválido o expirado' })
  getAvailability(
    @Query('token') token: string,
  ): Promise<AvailabilityEntryDto[]> {
    if (!token) throw new UnauthorizedException('Token requerido');
    return this.volunteersService.getAvailabilityByToken(token);
  }

  @Put('me/availability')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: [AvailabilityEntryDto] })
  @ApiUnauthorizedResponse({ description: 'Token inválido o expirado' })
  setAvailability(
    @Query('token') token: string,
    @Body() dto: SetAvailabilityDto,
  ): Promise<AvailabilityEntryDto[]> {
    if (!token) throw new UnauthorizedException('Token requerido');
    return this.volunteersService.setAvailabilityByToken(token, dto);
  }

  @Get('me/activities')
  @ApiOkResponse({ type: [VolunteerActivityDto] })
  @ApiUnauthorizedResponse({ description: 'Token inválido o expirado' })
  getActivities(
    @Query('token') token: string,
  ): Promise<VolunteerActivityDto[]> {
    if (!token) throw new UnauthorizedException('Token requerido');
    return this.volunteersService.getActivitiesByToken(token);
  }

  @Patch('submit')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Código de voluntario no encontrado' })
  submitForm(
    @Query('code') code: string,
    @Body() dto: VolunteerFormSubmitDto,
  ): Promise<void> {
    if (!code) throw new NotFoundException('Código requerido');
    return this.volunteersService.submitForm(code, dto);
  }
}
