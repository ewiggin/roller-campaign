import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('role_permissions')
export class RolePermissions {
  @PrimaryColumn('int')
  id: number;

  @Column({ type: 'simple-json', default: '[]' })
  region_admin: string[];

  @Column({ type: 'simple-json', default: '[]' })
  volunteer: string[];

  @Column({ type: 'simple-json', default: '[]' })
  volunteer_manager: string[];

  @Column({ type: 'simple-json', default: '[]' })
  guest_manager: string[];

  @Column({ type: 'simple-json', default: '[]' })
  host_manager: string[];

  @UpdateDateColumn()
  updated_at: Date;
}
