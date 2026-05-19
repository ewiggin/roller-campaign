import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Audit } from '../audit-logs/decorators/audit.decorator';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginResponseDto } from './dto/login-response.dto';
import { LoginDto } from './dto/login.dto';
import { MeResponseDto } from './dto/me-response.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import type { JwtPayload } from './strategies/jwt.strategy';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @UseGuards(LocalAuthGuard)
  @Audit('login', 'auth')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiUnauthorizedResponse({ description: 'Credenciales inválidas' })
  login(
    @Body() _dto: LoginDto,
    @CurrentUser() user: JwtPayload,
  ): LoginResponseDto {
    return this.authService.login(user);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: MeResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token inválido o expirado' })
  me(@CurrentUser() user: JwtPayload): MeResponseDto {
    return user;
  }
}
