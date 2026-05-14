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
import { Region } from '../../regions/entities/region.entity';
import { Volunteer } from '../../volunteers/entities/volunteer.entity';
import { GuestGroup } from '../../guest-groups/entities/guest-group.entity';

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

  @Column({ type: 'varchar' })
  date: string;

  @Column({ type: 'varchar' })
  start_time: string;

  @Column({ type: 'varchar' })
  end_time: string;

  @Column({ type: 'varchar', nullable: true, default: null })
  description: string | null;

  @Column({ type: 'varchar', default: 'draft' })
  status: ActivityStatus;

  @Column({ type: 'float', nullable: true, default: null })
  lat: number | null;

  @Column({ type: 'float', nullable: true, default: null })
  lng: number | null;

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

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
