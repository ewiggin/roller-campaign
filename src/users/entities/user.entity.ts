import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Region } from '../../regions/entities/region.entity';

export type UserRole = 'superadmin' | 'region_admin' | 'volunteer' | 'guest';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ default: 'volunteer' })
  role: UserRole;

  @ManyToMany('Region', (region: Region) => region.coordinators)
  regions: Region[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
