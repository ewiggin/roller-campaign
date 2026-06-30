import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RolePermissionsResponseDto } from './dto/role-permissions-response.dto';
import { SmtpSettingsResponseDto } from './dto/smtp-settings-response.dto';
import { CampaignSettingsResponseDto } from './dto/campaign-settings-response.dto';
import { UpdatePermissionsDto } from './dto/update-permissions.dto';
import { UpdateSmtpSettingsDto } from './dto/update-smtp-settings.dto';
import { UpdateCampaignSettingsDto } from './dto/update-campaign-settings.dto';
import { RolePermissions } from './entities/role-permissions.entity';
import { SmtpSettings } from './entities/smtp-settings.entity';
import { CampaignSettings } from './entities/campaign-settings.entity';

const SINGLETON_ID = 1;
const PERMISSIONS_ID = 1;
const CAMPAIGN_ID = 1;

const DEFAULT_REGION_ADMIN_SCREENS = [
  'dashboard',
  'regions',
  'hosts',
  'guest-groups',
  'guests',
  'activities',
  'volunteers',
  'carts',
];

export interface CampaignLimits {
  maxActivitiesPerGroup: number;
  maxPreachingShiftsPerGroup: number;
  maxGuestsPerPreachingGroup: number;
  maxFoodShiftsPerGroup: number;
}

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(SmtpSettings)
    private readonly repo: Repository<SmtpSettings>,
    @InjectRepository(RolePermissions)
    private readonly permsRepo: Repository<RolePermissions>,
    @InjectRepository(CampaignSettings)
    private readonly campaignRepo: Repository<CampaignSettings>,
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

  async getPermissions(): Promise<RolePermissionsResponseDto> {
    const row = await this.ensurePermsRow();
    return this.toPermsDto(row);
  }

  async updatePermissions(
    dto: UpdatePermissionsDto,
  ): Promise<RolePermissionsResponseDto> {
    const row = await this.ensurePermsRow();
    if (dto.region_admin !== undefined) row.region_admin = dto.region_admin;
    if (dto.volunteer !== undefined) row.volunteer = dto.volunteer;
    if (dto.volunteer_manager !== undefined)
      row.volunteer_manager = dto.volunteer_manager;
    if (dto.guest_manager !== undefined) row.guest_manager = dto.guest_manager;
    if (dto.host_manager !== undefined) row.host_manager = dto.host_manager;
    const saved = await this.permsRepo.save(row);
    return this.toPermsDto(saved);
  }

  async getCampaignSettings(): Promise<CampaignSettingsResponseDto> {
    const row = await this.ensureCampaignRow();
    return this.toCampaignDto(row);
  }

  async updateCampaignSettings(
    dto: UpdateCampaignSettingsDto,
  ): Promise<CampaignSettingsResponseDto> {
    const row = await this.ensureCampaignRow();
    if (dto.max_activities_per_group !== undefined)
      row.max_activities_per_group = dto.max_activities_per_group;
    if (dto.max_preaching_shifts_per_group !== undefined)
      row.max_preaching_shifts_per_group = dto.max_preaching_shifts_per_group;
    if (dto.max_guests_per_preaching_group !== undefined)
      row.max_guests_per_preaching_group = dto.max_guests_per_preaching_group;
    if (dto.max_food_shifts_per_group !== undefined)
      row.max_food_shifts_per_group = dto.max_food_shifts_per_group;
    const saved = await this.campaignRepo.save(row);
    return this.toCampaignDto(saved);
  }

  async getCampaignLimits(): Promise<CampaignLimits> {
    const row = await this.ensureCampaignRow();
    return {
      maxActivitiesPerGroup: row.max_activities_per_group,
      maxPreachingShiftsPerGroup: row.max_preaching_shifts_per_group,
      maxGuestsPerPreachingGroup: row.max_guests_per_preaching_group,
      maxFoodShiftsPerGroup: row.max_food_shifts_per_group,
    };
  }

  private async ensureCampaignRow(): Promise<CampaignSettings> {
    let row = await this.campaignRepo.findOne({ where: { id: CAMPAIGN_ID } });
    if (!row) {
      row = this.campaignRepo.create({
        id: CAMPAIGN_ID,
        max_activities_per_group: 4,
        max_preaching_shifts_per_group: 3,
      });
      row = await this.campaignRepo.save(row);
    }
    return row;
  }

  private toCampaignDto(row: CampaignSettings): CampaignSettingsResponseDto {
    const dto = new CampaignSettingsResponseDto();
    dto.max_activities_per_group = row.max_activities_per_group;
    dto.max_preaching_shifts_per_group = row.max_preaching_shifts_per_group;
    dto.max_guests_per_preaching_group = row.max_guests_per_preaching_group;
    dto.max_food_shifts_per_group = row.max_food_shifts_per_group;
    dto.updated_at = row.updated_at;
    return dto;
  }

  private async ensurePermsRow(): Promise<RolePermissions> {
    let row = await this.permsRepo.findOne({ where: { id: PERMISSIONS_ID } });
    if (!row) {
      row = this.permsRepo.create({
        id: PERMISSIONS_ID,
        region_admin: DEFAULT_REGION_ADMIN_SCREENS,
        volunteer: [],
        volunteer_manager: [],
        guest_manager: [],
        host_manager: [],
      });
      row = await this.permsRepo.save(row);
    }
    return row;
  }

  private toPermsDto(row: RolePermissions): RolePermissionsResponseDto {
    const dto = new RolePermissionsResponseDto();
    dto.region_admin = row.region_admin ?? DEFAULT_REGION_ADMIN_SCREENS;
    dto.volunteer = row.volunteer ?? [];
    dto.volunteer_manager = row.volunteer_manager ?? [];
    dto.guest_manager = row.guest_manager ?? [];
    dto.host_manager = row.host_manager ?? [];
    return dto;
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
