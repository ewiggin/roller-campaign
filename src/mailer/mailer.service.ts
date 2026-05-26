import { BadRequestException, Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class MailerService {
  constructor(private readonly settingsService: SettingsService) {}

  async sendMail(options: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<void> {
    const settings = await this.settingsService.getRawSmtp();

    if (!settings.enabled || !settings.host || !settings.user) {
      throw new BadRequestException('SMTP no configurado o deshabilitado');
    }

    const transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port ?? 587,
      secure: settings.secure,
      auth: {
        user: settings.user,
        pass: settings.password ?? '',
      },
    });

    const from = settings.from_name
      ? `"${settings.from_name}" <${settings.from_email ?? settings.user}>`
      : (settings.from_email ?? settings.user);

    await transporter.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
  }

  async sendTest(to: string): Promise<void> {
    await this.sendMail({
      to,
      subject: 'Test SMTP — Roller Campaign',
      html: '<p>La configuración SMTP funciona correctamente.</p>',
      text: 'La configuración SMTP funciona correctamente.',
    });
  }
}
