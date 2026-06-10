import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Region } from '../../regions/entities/region.entity';
import { Host } from '../../hosts/entities/host.entity';
import type { LocationPoint } from '../../activities/dto/location-point.dto';

@Entity('carts')
export class Cart {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Region, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'region_id' })
  region: Region;

  @Column()
  region_id: string;

  @ManyToOne(() => Host, { nullable: true, onDelete: 'SET NULL', eager: false })
  @JoinColumn({ name: 'host_id' })
  host: Host | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  host_id: string | null;

  @Column({ type: 'varchar', default: '' })
  number: string;

  @Column({ type: 'simple-json', nullable: true, default: null })
  primary_location: LocationPoint | null;

  @Column({ type: 'simple-json', nullable: true, default: null })
  secondary_location: LocationPoint | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  image_key: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
