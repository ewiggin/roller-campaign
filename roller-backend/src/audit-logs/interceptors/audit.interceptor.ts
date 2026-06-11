import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';
import { AUDIT_KEY, AuditMeta } from '../decorators/audit.decorator';
import { AuditLogsService } from '../audit-logs.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.getAllAndOverride<AuditMeta | undefined>(
      AUDIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!meta || meta.action === 'list') return next.handle();

    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user as JwtPayload | undefined;
    const resourceId = (req.params as Record<string, string>)['id'] ?? null;
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)
        ?.split(',')[0]
        ?.trim() ??
      req.ip ??
      null;
    const userAgent =
      (req.headers['user-agent'] as string | undefined)?.slice(0, 200) ?? null;

    return next.handle().pipe(
      tap({
        next: () => {
          void this.auditLogsService.log({
            actor_id: user?.sub ?? null,
            actor_email: user?.email ?? null,
            actor_role: user?.role ?? null,
            action: meta.action,
            resource: meta.resource,
            resource_id: resourceId,
            ip_address: ip,
            user_agent: userAgent,
          });
        },
      }),
    );
  }
}
