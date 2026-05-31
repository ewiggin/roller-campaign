import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SmtpSettingsResponseDto } from './dto/smtp-settings-response.dto';
import { UpdateSmtpSettingsDto } from './dto/update-smtp-settings.dto';
import { SmtpSettings } from './entities/smtp-settings.entity';

const SINGLETON_ID = 1;

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(SmtpSettings)
    private readonly repo: Repository<SmtpSettings>,
  ) {}

  async getSmtp(): Promise<SmtpSettingsResponseDto> {
    const row = await this.ensureRow();
    return this.toDto(row);
  }

  async updateSmtp(
    dto: UpdateSmtpSettingsDto,
  ): Promise<SmtpSettingsResponseDto> {
    const row = await this.ensureRow();
    Object.assign(row, dto);
    const saved = await this.repo.save(row);
    return this.toDto(saved);
  }

  async getRawSmtp(): Promise<SmtpSettings> {
    return this.ensureRow();
  }

  private async ensureRow(): Promise<SmtpSettings> {
    let row = await this.repo.findOne({ where: { id: SINGLETON_ID } });
    if (!row) {
      row = this.repo.create({ id: SINGLETON_ID });
      row = await this.repo.save(row);
    }
    return row;
  }

  private toDto(row: SmtpSettings): SmtpSettingsResponseDto {
    const dto = new SmtpSettingsResponseDto();
    dto.host = row.host;
    dto.port = row.port;
    dto.secure = row.secure;
    dto.user = row.user;
    dto.from_name = row.from_name;
    dto.from_email = row.from_email;
    dto.enabled = row.enabled;
    dto.updated_at = row.updated_at;
    return dto;
  }
}
