import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { GuestGroup } from '../../guest-groups/entities/guest-group.entity';
import { Region } from '../../regions/entities/region.entity';

export type GuestStatus = 'pending' | 'confirmed' | 'cancelled' | 'arrived' | 'blocked';
export type TransportMode = 'car' | 'bus' | 'train' | 'plane' | 'ferry' | 'motorbike' | 'other';

@Entity('guests')
export class Guest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // --- Identification ---
  @Column({ unique: true })
  guest_code: string;

  @ManyToOne(() => GuestGroup, (group) => group.guests, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'group_id' })
  group: GuestGroup;

  @Column()
  group_id: string;

  @ManyToOne(() => Region, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'region_id' })
  region: Region;

  @Column()
  region_id: string;

  @Column()
  full_name: string;

  @Column({ default: false })
  is_minor: boolean;

  @Column({ default: 'pending' })
  status: GuestStatus;

  @Column({ type: 'varchar', nullable: true, default: null })
  branch: string | null;

  @Column({ default: false })
  is_group_contact: boolean;

  // --- Languages ---
  @Column({ type: 'varchar', nullable: true, default: null })
  native_language: string | null;

  @Column({ type: 'simple-array', nullable: true, default: null })
  other_languages: string[] | null;

  @Column({ default: false })
  speaks_english: boolean;

  // --- Profile ---
  @Column({ default: false })
  is_special_servant: boolean;

  @Column({ type: 'varchar', nullable: true, default: null })
  origin_city: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  email: string | null;

  // --- Availability ---
  @Column({ type: 'varchar', nullable: true, default: null })
  available_from: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  available_to: string | null;

  // --- Arrival ---
  @Column({ type: 'varchar', nullable: true, default: null })
  arrival_transport: TransportMode | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  arrival_other_transport: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  arrival_date: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  arrival_time: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  arrival_place: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  arrival_airport: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  arrival_airline: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  arrival_flight: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  real_arrival: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  real_arrival_time: string | null;

  @Column({ default: false })
  needs_airport_transfer: boolean;

  // --- Departure ---
  @Column({ type: 'varchar', nullable: true, default: null })
  departure_transport: TransportMode | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  departure_other_transport: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  departure_date: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  departure_time: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  departure_place: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  departure_airport: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  departure_airline: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  departure_flight: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  real_departure: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  real_departure_time: string | null;

  // --- Accommodation ---
  @Column({ type: 'varchar', nullable: true, default: null })
  accommodation: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  checkin_date: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  checkout_date: string | null;

  @Column({ default: false })
  needs_special_accommodation: boolean;

  @Column({ type: 'varchar', nullable: true, default: null })
  hosting_address: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  maps_link: string | null;

  @Column({ type: 'float', nullable: true, default: null })
  lat: number | null;

  @Column({ type: 'float', nullable: true, default: null })
  lng: number | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  transport_mode: string | null;

  // --- Car ---
  @Column({ type: 'int', nullable: true, default: null })
  car_seats: number | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
