import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailerService } from '../mailer/mailer.service';
import { SmtpSettings } from './entities/smtp-settings.entity';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [TypeOrmModule.forFeature([SmtpSettings])],
  controllers: [SettingsController],
  providers: [SettingsService, MailerService],
  exports: [SettingsService, MailerService],
})
export class SettingsModule {}
