import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuditLogsService } from '../../../core/services/audit-logs.service';
import type { AuditLog, AuditAction, AuditResource } from '../../../core/models/audit-log.model';

const RESOURCES: AuditResource[] = ['auth', 'user', 'region', 'guest_group', 'guest', 'host', 'volunteer', 'activity'];
const ACTIONS: AuditAction[] = ['login', 'list', 'read', 'create', 'update', 'delete', 'export', 'import', 'migrate', 'generate_token', 'form_lookup', 'form_submit'];

@Component({
  selector: 'app-audit-logs-list',
  imports: [FormsModule, DatePipe, DecimalPipe],
  templateUrl: './audit-logs-list.html',
})
export class AuditLogsListComponent implements OnInit {
  private readonly svc = inject(AuditLogsService);

  readonly resources = RESOURCES;
  readonly actions = ACTIONS;

  readonly logs = signal<AuditLog[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly exporting = signal(false);

  readonly filterResource = signal('');
  readonly filterAction = signal('');
  readonly filterEmail = signal('');
  readonly filterFrom = signal('');
  readonly filterTo = signal('');
  readonly page = signal(1);
  readonly limit = 50;

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.limit)));
  readonly pageEnd = computed(() => Math.min(this.page() * this.limit, this.total()));

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.svc.getAll({
      page: this.page(),
      limit: this.limit,
      resource: this.filterResource() || undefined,
      action: this.filterAction() || undefined,
      actor_email: this.filterEmail() || undefined,
      from: this.filterFrom() || undefined,
      to: this.filterTo() || undefined,
    }).subscribe({
      next: (res) => {
        this.logs.set(res.data);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Error loading audit logs.');
        this.loading.set(false);
      },
    });
  }

  applyFilters() {
    this.page.set(1);
    this.load();
  }

  resetFilters() {
    this.filterResource.set('');
    this.filterAction.set('');
    this.filterEmail.set('');
    this.filterFrom.set('');
    this.filterTo.set('');
    this.applyFilters();
  }

  prevPage() {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
      this.load();
    }
  }

  nextPage() {
    if (this.page() < this.totalPages()) {
      this.page.update((p) => p + 1);
      this.load();
    }
  }

  exportCsv() {
    this.exporting.set(true);
    this.svc.exportCsv({
      resource: this.filterResource() || undefined,
      action: this.filterAction() || undefined,
      actor_email: this.filterEmail() || undefined,
      from: this.filterFrom() || undefined,
      to: this.filterTo() || undefined,
    }).subscribe({
      next: (res) => {
        const headers = ['timestamp', 'actor_email', 'actor_role', 'action', 'resource', 'resource_id', 'ip_address', 'user_agent'];
        const rows = res.data.map((log) => [
          log.timestamp,
          log.actor_email ?? '',
          log.actor_role ?? '',
          log.action,
          log.resource,
          log.resource_id ?? '',
          log.ip_address ?? '',
          `"${(log.user_agent ?? '').replace(/"/g, '""')}"`,
        ].join(','));
        const csv = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        this.exporting.set(false);
      },
      error: () => {
        alert('Error exporting audit log.');
        this.exporting.set(false);
      },
    });
  }

  actionBadgeClass(action: AuditAction): string {
    const map: Partial<Record<AuditAction, string>> = {
      delete: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950 dark:text-red-400 dark:ring-red-800',
      create: 'bg-green-50 text-green-700 ring-green-200 dark:bg-green-950 dark:text-green-400 dark:ring-green-800',
      update: 'bg-yellow-50 text-yellow-700 ring-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:ring-yellow-800',
      export: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:ring-blue-800',
      import: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:ring-blue-800',
      login: 'bg-purple-50 text-purple-700 ring-purple-200 dark:bg-purple-950 dark:text-purple-400 dark:ring-purple-800',
    };
    return map[action] ?? 'bg-gray-50 text-gray-600 ring-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700';
  }
}
