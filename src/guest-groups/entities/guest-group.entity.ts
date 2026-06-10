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
import type { Guest } from '../../guests/entities/guest.entity';
import type { Host } from '../../hosts/entities/host.entity';

@Entity('guest_groups')
export class GuestGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  group_code: string;

  @ManyToOne(() => Region, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'region_id' })
  region: Region;

  @Column()
  region_id: string;

  @ManyToOne('Host', { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'host_id' })
  host: Host;

  @Column({ nullable: true, default: null })
  host_id: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  available_from: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  available_to: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  composition: 'men_only' | 'mixed' | 'women_only' | null;

  @Column({ type: 'int', nullable: true, default: null })
  car_count: number | null;

  // --- Aggregated snapshot of guest data (precomputed so the guests table
  // --- can eventually be removed; NULL = never computed)
  @Column({ type: 'int', nullable: true, default: null })
  agg_guest_count: number | null;

  @Column({ type: 'int', nullable: true, default: null })
  agg_minor_count: number | null;

  @Column({ type: 'simple-json', nullable: true, default: null })
  agg_status_counts: Record<string, number> | null;

  @Column({ type: 'float', nullable: true, default: null })
  agg_avg_lat: number | null;

  @Column({ type: 'float', nullable: true, default: null })
  agg_avg_lng: number | null;

  @Column({ type: 'simple-array', nullable: true, default: null })
  agg_languages: string[] | null;

  @Column({ type: 'boolean', nullable: true, default: null })
  agg_speaks_english: boolean | null;

  @Column({ type: 'int', nullable: true, default: null })
  agg_car_seats: number | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  agg_computed_at: string | null;

  @OneToMany('Guest', (guest: Guest) => guest.group)
  guests: Guest[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
