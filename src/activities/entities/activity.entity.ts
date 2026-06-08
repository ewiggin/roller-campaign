import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Region } from '../../regions/entities/region.entity';
import { Host } from '../../hosts/entities/host.entity';
import { Volunteer } from '../../volunteers/entities/volunteer.entity';
import { GuestGroup } from '../../guest-groups/entities/guest-group.entity';
import { ActivityPreachingGroup } from './activity-preaching-group.entity';
import { LocationPoint } from '../dto/location-point.dto';

export type ActivityStatus = 'draft' | 'published';

@Entity('activities')
export class Activity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Region, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'region_id' })
  region: Region;

  @Column()
  region_id: string;

  @Column({ type: 'varchar', nullable: true, default: null })
  series_id: string | null;

  @Column({ type: 'varchar', default: '' })
  name: string;

  @Column({ type: 'varchar', nullable: true, default: null })
  icon: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  description: string | null;

  @Column({ type: 'varchar', default: 'draft' })
  status: ActivityStatus;

  @Column({ type: 'int', nullable: true, default: null })
  required_volunteers: number | null;

  @Column({ type: 'int', nullable: true, default: null })
  max_guests: number | null;

  @ManyToOne(() => Host, { nullable: true, onDelete: 'SET NULL', eager: false })
  @JoinColumn({ name: 'host_id' })
  host: Host | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  host_id: string | null;

  @Column({ type: 'varchar' })
  date: string;

  @Column({ type: 'varchar' })
  start_time: string;

  @Column({ type: 'varchar' })
  end_time: string;

  @Column({ type: 'simple-json', nullable: true, default: null })
  activity_locations: LocationPoint[] | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  image_key: string | null;

  @Column({ type: 'boolean', default: false })
  is_preaching_shift: boolean;

  @ManyToMany(() => Volunteer, (v) => v.activities, { eager: false })
  @JoinTable({ name: 'activity_volunteers' })
  volunteers: Volunteer[];

  @ManyToMany(() => GuestGroup, { eager: false })
  @JoinTable({
    name: 'activity_guest_groups',
    joinColumn: { name: 'activityId' },
    inverseJoinColumn: { name: 'guestGroupId' },
  })
  guestGroups: GuestGroup[];

  @OneToMany(() => ActivityPreachingGroup, (pg) => pg.activity, {
    eager: false,
  })
  preachingGroups: ActivityPreachingGroup[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
