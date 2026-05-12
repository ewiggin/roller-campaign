import { Controller, Get, Query, UnauthorizedException } from '@nestjs/common';
import { ApiOkResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { GuestsService } from './guests.service';
import { GuestMeResponseDto } from './dto/guest-me-response.dto';

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
}
