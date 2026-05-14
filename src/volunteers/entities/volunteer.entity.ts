import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Region } from '../../regions/entities/region.entity';
import { VolunteerRole } from './volunteer-role.entity';
import { VolunteerAvailability } from './volunteer-availability.entity';

@Entity('volunteers')
export class Volunteer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  volunteer_code: string;

  @Column()
  full_name: string;

  @Column({ type: 'varchar', nullable: true, default: null })
  email: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  phone: string | null;

  @Column({ default: true })
  is_active: boolean;

  @Column({ type: 'varchar', nullable: true, default: null })
  user_id: string | null;

  @ManyToMany(() => Region, { eager: false })
  @JoinTable({ name: 'volunteer_regions' })
  regions: Region[];

  @ManyToMany(() => VolunteerRole, { eager: false })
  @JoinTable({ name: 'volunteer_role_assignments' })
  roles: VolunteerRole[];

  @OneToMany(() => VolunteerAvailability, (a) => a.volunteer)
  availability: VolunteerAvailability[];

  @ManyToMany('Activity', (activity: { volunteers: Volunteer[] }) => activity.volunteers)
  activities: unknown[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
