import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Volunteer } from './volunteer.entity';
import { Region } from '../../regions/entities/region.entity';

@Entity('volunteer_availability')
@Unique(['volunteer_id', 'region_id', 'date'])
export class VolunteerAvailability {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Volunteer, (v) => v.availability, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'volunteer_id' })
  volunteer: Volunteer;

  @Column()
  volunteer_id: string;

  @ManyToOne(() => Region, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'region_id' })
  region: Region;

  @Column()
  region_id: string;

  @Column({ type: 'varchar' })
  date: string;

  @Column({ type: 'varchar', nullable: true, default: null })
  note: string | null;

  @CreateDateColumn()
  created_at: Date;
}
