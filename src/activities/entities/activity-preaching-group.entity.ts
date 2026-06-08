import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Activity } from './activity.entity';
import { GuestGroup } from '../../guest-groups/entities/guest-group.entity';

@Entity('activity_preaching_groups')
export class ActivityPreachingGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Activity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'activity_id' })
  activity: Activity;

  @Column()
  activity_id: string;

  @Column({ type: 'varchar', nullable: true, default: null })
  name: string | null;

  @Column({ type: 'int', default: 0 })
  position: number;

  @ManyToMany(() => GuestGroup, { eager: false })
  @JoinTable({
    name: 'activity_preaching_group_guest_groups',
    joinColumn: { name: 'preachingGroupId' },
    inverseJoinColumn: { name: 'guestGroupId' },
  })
  guestGroups: GuestGroup[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
