import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Audit } from '../audit-logs/decorators/audit.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MailerService } from '../mailer/mailer.service';
import { RolePermissionsResponseDto } from './dto/role-permissions-response.dto';
import { SmtpSettingsResponseDto } from './dto/smtp-settings-response.dto';
import { TestSmtpDto } from './dto/test-smtp.dto';
import { UpdatePermissionsDto } from './dto/update-permissions.dto';
import { UpdateSmtpSettingsDto } from './dto/update-smtp-settings.dto';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly mailerService: MailerService,
  ) {}

  @Get('permissions')
  @ApiOkResponse({ type: RolePermissionsResponseDto })
  getPermissions(): Promise<RolePermissionsResponseDto> {
    return this.settingsService.getPermissions();
  }

  @Patch('permissions')
  @Audit('update', 'settings')
  @ApiOkResponse({ type: RolePermissionsResponseDto })
  updatePermissions(
    @Body() dto: UpdatePermissionsDto,
  ): Promise<RolePermissionsResponseDto> {
    return this.settingsService.updatePermissions(dto);
  }

  @Get('smtp')
  @ApiOkResponse({ type: SmtpSettingsResponseDto })
  getSmtp(): Promise<SmtpSettingsResponseDto> {
    return this.settingsService.getSmtp();
  }

  @Patch('smtp')
  @Audit('update', 'settings')
  @ApiOkResponse({ type: SmtpSettingsResponseDto })
  updateSmtp(
    @Body() dto: UpdateSmtpSettingsDto,
  ): Promise<SmtpSettingsResponseDto> {
    return this.settingsService.updateSmtp(dto);
  }

  @Post('smtp/test')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Test email sent' })
  testSmtp(@Body() dto: TestSmtpDto): Promise<void> {
    return this.mailerService.sendTest(dto.to);
  }
}
