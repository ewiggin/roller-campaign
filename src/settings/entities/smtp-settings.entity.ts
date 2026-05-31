import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('smtp_settings')
export class SmtpSettings {
  @PrimaryColumn('int')
  id: number;

  @Column({ type: 'varchar', nullable: true, default: null })
  host: string | null;

  @Column({ type: 'int', nullable: true, default: null })
  port: number | null;

  @Column({ type: 'boolean', default: false })
  secure: boolean;

  @Column({ type: 'varchar', nullable: true, default: null })
  user: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  password: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  from_name: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  from_email: string | null;

  @Column({ default: false })
  enabled: boolean;

  @UpdateDateColumn()
  updated_at: Date;
}
