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

  @Column({ type: 'int', default: 1 })
  max_food_shifts_per_group: number;

  @Column({ type: 'boolean', default: true })
  restrict_same_name_activity_group: boolean;

  @UpdateDateColumn()
  updated_at: Date;
}
