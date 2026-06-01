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

  @Column({ type: 'varchar', nullable: true, default: null })
  hosting_address: string | null;

  @Column({ type: 'float', nullable: true, default: null })
  lat: number | null;

  @Column({ type: 'float', nullable: true, default: null })
  lng: number | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  maps_link: string | null;

  @Column({ type: 'int', nullable: true, default: null })
  car_seats: number | null;

  @Column({ default: false })
  monday_morning: boolean;

  @Column({ default: false })
  monday_afternoon: boolean;

  @Column({ default: false })
  tuesday_morning: boolean;

  @Column({ default: false })
  tuesday_afternoon: boolean;

  @Column({ default: false })
  wednesday_morning: boolean;

  @Column({ default: false })
  wednesday_afternoon: boolean;

  @Column({ default: false })
  thursday_morning: boolean;

  @Column({ default: false })
  thursday_afternoon: boolean;

  @Column({ default: false })
  friday_morning: boolean;

  @Column({ default: false })
  friday_afternoon: boolean;

  @Column({ default: false })
  saturday_morning: boolean;

  @Column({ default: false })
  saturday_afternoon: boolean;

  @Column({ default: false })
  sunday_morning: boolean;

  @Column({ default: false })
  sunday_afternoon: boolean;

  @Column({ type: 'boolean', nullable: true, default: null })
  terms_accepted: boolean | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  terms_version: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  terms_accepted_at: string | null;

  @ManyToMany(
    'Activity',
    (activity: { volunteers: Volunteer[] }) => activity.volunteers,
  )
  activities: unknown[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
