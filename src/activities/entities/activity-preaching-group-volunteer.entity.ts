import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('activity_preaching_group_volunteers')
@Unique(['preaching_group_id', 'volunteer_id'])
export class ActivityPreachingGroupVolunteer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  preaching_group_id: string;

  @Column()
  volunteer_id: string;

  @Column({ type: 'varchar', nullable: true, default: null })
  description: string | null;
}
