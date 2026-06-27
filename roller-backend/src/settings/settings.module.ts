import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailerService } from '../mailer/mailer.service';
import { CampaignSettings } from './entities/campaign-settings.entity';
import { RolePermissions } from './entities/role-permissions.entity';
import { SmtpSettings } from './entities/smtp-settings.entity';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [TypeOrmModule.forFeature([SmtpSettings, RolePermissions, CampaignSettings])],
  controllers: [SettingsController],
  providers: [SettingsService, MailerService],
  exports: [SettingsService, MailerService],
})
export class SettingsModule {}
