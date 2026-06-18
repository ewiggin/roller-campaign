import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type AuditAction =
  | 'login'
  | 'list'
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'truncate'
  | 'export'
  | 'import'
  | 'migrate'
  | 'generate_token'
  | 'form_lookup'
  | 'form_submit'
  | 'reset';

export type AuditResource =
  | 'auth'
  | 'user'
  | 'region'
  | 'guest_group'
  | 'guest'
  | 'host'
  | 'volunteer'
  | 'activity'
  | 'settings';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  timestamp: Date;

  @Column({ type: 'varchar', nullable: true, default: null })
  actor_id: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  actor_email: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  actor_role: string | null;

  @Column()
  action: AuditAction;

  @Column()
  resource: AuditResource;

  @Column({ type: 'varchar', nullable: true, default: null })
  resource_id: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  ip_address: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  user_agent: string | null;

  @Column({ type: 'simple-json', nullable: true, default: null })
  metadata: Record<string, unknown> | null;
}
