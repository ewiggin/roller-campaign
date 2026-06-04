import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('activity_volunteer_roles')
@Unique(['activity_id', 'volunteer_id'])
export class ActivityVolunteerRole {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  activity_id: string;

  @Column()
  volunteer_id: string;

  @Column({ type: 'varchar', nullable: true, default: null })
  role_id: string | null;
}
