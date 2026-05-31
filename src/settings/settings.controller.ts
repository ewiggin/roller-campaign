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
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MailerService } from '../mailer/mailer.service';
import { SmtpSettingsResponseDto } from './dto/smtp-settings-response.dto';
import { TestSmtpDto } from './dto/test-smtp.dto';
import { UpdateSmtpSettingsDto } from './dto/update-smtp-settings.dto';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('superadmin')
@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly mailerService: MailerService,
  ) {}

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
