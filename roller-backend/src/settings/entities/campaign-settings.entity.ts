import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('campaign_settings')
export class CampaignSettings {
  @PrimaryColumn('int')
  id: number;

  @Column({ type: 'int', default: 4 })
  max_activities_per_group: number;

  @Column({ type: 'int', default: 4 })
  max_preaching_shifts_per_group: number;

  @Column({ type: 'int', default: 3 })
  max_guests_per_preaching_group: number;

  @UpdateDateColumn()
  updated_at: Date;
}
