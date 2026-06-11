import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import type { AuditLogQueryDto } from './dto/audit-log-query.dto';
import type { AuditLogPageResponseDto } from './dto/audit-log-response.dto';

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  async log(entry: Omit<Partial<AuditLog>, 'id' | 'timestamp'>): Promise<void> {
    try {
      await this.repo.save(this.repo.create(entry as Partial<AuditLog>));
    } catch (err) {
      this.logger.error('Failed to write audit log', err);
    }
  }

  async findAll(query: AuditLogQueryDto): Promise<AuditLogPageResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;

    const qb = this.repo
      .createQueryBuilder('log')
      .orderBy('log.timestamp', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.resource)
      qb.andWhere('log.resource = :resource', { resource: query.resource });
    if (query.action)
      qb.andWhere('log.action = :action', { action: query.action });
    if (query.actor_email)
      qb.andWhere('log.actor_email ILIKE :email', {
        email: `%${query.actor_email}%`,
      });
    if (query.from)
      qb.andWhere('log.timestamp >= :from', { from: new Date(query.from) });
    if (query.to) {
      const toDate = new Date(query.to);
      toDate.setDate(toDate.getDate() + 1);
      qb.andWhere('log.timestamp < :to', { to: toDate });
    }

    const [data, total] = await qb.getManyAndCount();

    return { data, total, page, limit };
  }
}
