import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('regions')
export class Region {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ type: 'varchar', nullable: true, default: null })
  event_start_date: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  event_end_date: string | null;

  @ManyToMany(() => User, (user) => user.regions, { eager: false })
  @JoinTable({ name: 'region_coordinators' })
  coordinators: User[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
