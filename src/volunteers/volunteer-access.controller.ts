import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { VolunteerFormLookupResponseDto } from './dto/volunteer-form-lookup.dto';
import { VolunteerFormSubmitDto } from './dto/volunteer-form-submit.dto';
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
