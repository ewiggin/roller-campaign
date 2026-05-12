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

@Entity('turns')
export class Turn {
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

  @ManyToMany(() => Volunteer, (v) => v.turns, { eager: false })
  @JoinTable({ name: 'turn_volunteers' })
  volunteers: Volunteer[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
