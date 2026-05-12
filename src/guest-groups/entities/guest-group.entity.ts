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

  @OneToMany('Guest', (guest: Guest) => guest.group)
  guests: Guest[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
