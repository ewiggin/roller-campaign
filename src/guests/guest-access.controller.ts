import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Patch,
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
import { GuestsService } from './guests.service';
import { GuestMeResponseDto } from './dto/guest-me-response.dto';
import { GuestFormLookupResponseDto } from './dto/guest-form-lookup.dto';
import { GuestFormSubmitDto } from './dto/guest-form-submit.dto';

@ApiTags('guest-access')
@Controller('guest-access')
export class GuestAccessController {
  constructor(private readonly guestsService: GuestsService) {}

  @Get('me')
  @ApiOkResponse({ type: GuestMeResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token inválido o expirado' })
  getMe(@Query('token') token: string): Promise<GuestMeResponseDto> {
    if (!token) throw new UnauthorizedException('Token requerido');
    return this.guestsService.getByToken(token);
  }

  @Get('lookup')
  @ApiOkResponse({ type: GuestFormLookupResponseDto })
  @ApiNotFoundResponse({ description: 'Código de invitado no encontrado' })
  lookupByCode(@Query('code') code: string): Promise<GuestFormLookupResponseDto> {
    if (!code) throw new NotFoundException('Código requerido');
    return this.guestsService.lookupByCode(code);
  }

  @Patch('submit')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Código de invitado no encontrado' })
  submitForm(
    @Query('code') code: string,
    @Body() dto: GuestFormSubmitDto,
  ): Promise<void> {
    if (!code) throw new NotFoundException('Código requerido');
    return this.guestsService.submitForm(code, dto);
  }
}
