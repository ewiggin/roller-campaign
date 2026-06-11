import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Region } from '../../regions/entities/region.entity';
import type { GuestGroup } from '../../guest-groups/entities/guest-group.entity';

@Entity('hosts')
export class Host {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @ManyToOne(() => Region, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'region_id' })
  region: Region;

  @Column()
  region_id: string;

  @Column({ type: 'varchar', nullable: true, default: null })
  address: string | null;

  @Column({ type: 'float', nullable: true, default: null })
  lat: number | null;

  @Column({ type: 'float', nullable: true, default: null })
  lng: number | null;

  /** 1 = Monday … 7 = Sunday */
  @Column({ type: 'int', nullable: true, default: null })
  weekday_meeting_day: number | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  weekday_meeting_time: string | null;

  /** 1 = Monday … 7 = Sunday */
  @Column({ type: 'int', nullable: true, default: null })
  weekend_meeting_day: number | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  weekend_meeting_time: string | null;

  @Column({ type: 'int', nullable: true, default: null })
  capacity: number | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  note: string | null;

  @OneToMany('GuestGroup', (g: GuestGroup) => g.host)
  groups: GuestGroup[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
