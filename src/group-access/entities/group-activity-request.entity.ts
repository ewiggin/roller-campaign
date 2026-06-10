import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Activity } from '../../activities/entities/activity.entity';
import { GuestGroup } from '../../guest-groups/entities/guest-group.entity';

@Entity('group_activity_requests')
@Unique(['group_id', 'activity_id'])
export class GroupActivityRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  group_id: string;

  @Column()
  activity_id: string;

  @Column({ type: 'integer' })
  preference: number; // 1=primera opción, 2=segunda opción, 3=si hace falta

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => GuestGroup, { onDelete: 'CASCADE' })
  group: GuestGroup;

  @ManyToOne(() => Activity, { onDelete: 'CASCADE' })
  activity: Activity;
}
