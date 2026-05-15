import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { GuestsService } from '../../../core/services/guests.service';
import { GuestGroupsService } from '../../../core/services/guest-groups.service';
import { RegionsService } from '../../../core/services/regions.service';
import { AuthService } from '../../../core/services/auth.service';
import type { Guest, GuestStatus, ImportParseResponse, ImportGuestRow, ImportCommitResponse } from '../../../core/models/guest.model';
import type { Region } from '../../../core/models/region.model';
import type { GuestGroup } from '../../../core/models/guest-group.model';

const STATUSES: GuestStatus[] = ['pending', 'confirmed', 'cancelled', 'arrived', 'blocked'];

@Component({
  selector: 'app-guests-list',
  imports: [FormsModule, RouterLink],
  templateUrl: './guests-list.html',
})
export class GuestsListComponent implements OnInit {
  private readonly svc = inject(GuestsService);
  private readonly groupsSvc = inject(GuestGroupsService);
  private readonly regionsSvc = inject(RegionsService);
  private readonly auth = inject(AuthService);

  readonly isSuperAdmin = this.auth.isSuperAdmin;
  readonly statuses = STATUSES;

  readonly regions = signal<Region[]>([]);
  readonly groups = signal<GuestGroup[]>([]);
  readonly guests = signal<Guest[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly error = signal('');

  // Filters
  readonly filterRegion = signal('');
  readonly filterGroup = signal('');
  readonly filterStatus = signal('');
  readonly filterSearch = signal('');
  readonly page = signal(1);
  readonly limit = 50;

  readonly filteredGroups = computed(() => {
    const rid = this.filterRegion();
    return rid ? this.groups().filter((g) => g.region_id === rid) : this.groups();
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.limit)));

  // Import modal
  readonly importModal = signal(false);
  readonly importStep = signal<'upload' | 'preview' | 'done'>('upload');
  readonly importMode = signal<'region' | 'group'>('region');
  readonly importRegionId = signal('');
  readonly importing = signal(false);
  readonly importError = signal('');
  readonly parseResult = signal<ImportParseResponse | null>(null);
  readonly commitResult = signal<ImportCommitResponse | null>(null);
  readonly importUpdateExisting = signal(false);
  isDragging = false;

  // Token modal
  readonly tokenModal = signal(false);
  readonly tokenData = signal<{ token: string; access_url: string } | null>(null);
  readonly tokenLoading = signal(false);

  ngOnInit() {
    this.regionsSvc.getAll().subscribe({
      next: (r) => {
        this.regions.set(r);
        if (r.length > 0) this.filterRegion.set(r[0].id);
      },
    });
    this.groupsSvc.getAll({ limit: 500 }).subscribe({ next: (res) => this.groups.set(res.data) });
    this.load();
  }

  load() {
    this.loading.set(true);
    this.svc
      .getAll({
        regionId: this.filterRegion() || undefined,
        groupId: this.filterGroup() || undefined,
        status: (this.filterStatus() as GuestStatus) || undefined,
        search: this.filterSearch() || undefined,
        page: this.page(),
        limit: this.limit,
      })
      .subscribe({
        next: (res) => {
          this.guests.set(res.data);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Error loading guests.');
          this.loading.set(false);
        },
      });
  }

  applyFilters() {
    this.page.set(1);
    this.load();
  }

  onRegionChange(id: string) {
    this.filterRegion.set(id);
    this.filterGroup.set('');
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

  deleteGuest(guest: Guest) {
    if (!confirm(`Delete guest "${guest.full_name}" (${guest.guest_code})?`)) return;
    this.svc.remove(guest.id).subscribe({
      next: () => this.load(),
      error: () => alert('Error deleting guest.'),
    });
  }

  showToken(guest: Guest) {
    this.tokenLoading.set(true);
    this.tokenModal.set(true);
    this.tokenData.set(null);
    this.svc.generateToken(guest.id).subscribe({
      next: (data) => {
        this.tokenData.set(data);
        this.tokenLoading.set(false);
      },
      error: () => {
        this.tokenLoading.set(false);
        this.tokenModal.set(false);
        alert('Error generating token.');
      },
    });
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  downloadExcel() {
    this.svc.exportExcel({
      regionId: this.filterRegion() || undefined,
      groupId: this.filterGroup() || undefined,
      status: (this.filterStatus() as import('../../../core/models/guest.model').GuestStatus) || undefined,
      search: this.filterSearch() || undefined,
    }).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'invitados.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  downloadTemplate() {
    this.svc.downloadTemplate().subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'plantilla-invitados.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  openImport() {
    this.importStep.set('upload');
    this.importMode.set('region');
    this.importRegionId.set(this.filterRegion() || (this.regions()[0]?.id ?? ''));
    this.importError.set('');
    this.parseResult.set(null);
    this.commitResult.set(null);
    this.importUpdateExisting.set(false);
    this.importModal.set(true);
  }

  closeImport() {
    this.importModal.set(false);
    if (this.importStep() === 'done') this.load();
  }

  onDragOver(ev: DragEvent) {
    ev.preventDefault();
    this.isDragging = true;
  }

  onDragLeave() {
    this.isDragging = false;
  }

  onDrop(ev: DragEvent) {
    ev.preventDefault();
    this.isDragging = false;
    const file = ev.dataTransfer?.files[0];
    if (file) this.parseFile(file);
  }

  onFileSelected(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (file) this.parseFile(file);
  }

  private parseFile(file: File) {
    const regionId = this.importMode() === 'region' ? this.importRegionId() : undefined;
    if (this.importMode() === 'region' && !regionId) {
      this.importError.set('Select a region first.');
      return;
    }
    this.importing.set(true);
    this.importError.set('');
    this.svc.parseImport(file, regionId).subscribe({
      next: (result) => {
        this.parseResult.set(result);
        this.importStep.set('preview');
        this.importing.set(false);
      },
      error: () => {
        this.importError.set('Error parsing file. Check the format.');
        this.importing.set(false);
      },
    });
  }

  downloadNotFound() {
    const rows = this.commitResult()?.groups_not_found_rows;
    if (!rows?.length) return;
    this.svc.exportNotFound(rows).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'invitados-sin-grupo.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  get canCommit(): boolean {
    const result = this.parseResult();
    if (!result) return false;
    return result.valid.length > 0 || (this.importUpdateExisting() && (result.duplicateRows?.length ?? 0) > 0);
  }

  get commitLabel(): string {
    const result = this.parseResult();
    if (!result) return 'Import';
    const creates = result.valid.length;
    const updates = this.importUpdateExisting() ? (result.duplicateRows?.length ?? 0) : 0;
    const parts: string[] = [];
    if (creates > 0) parts.push(`Import ${creates} new`);
    if (updates > 0) parts.push(`update ${updates} existing`);
    return parts.join(' + ') || 'Import';
  }

  commitImport() {
    const result = this.parseResult();
    if (!result || !this.canCommit) return;
    this.importing.set(true);
    this.importError.set('');
    const regionId = this.importMode() === 'region' ? this.importRegionId() : undefined;
    const updateRows = this.importUpdateExisting() ? (result.duplicateRows ?? []) : undefined;
    this.svc.commitImport(result.valid as ImportGuestRow[], updateRows, regionId).subscribe({
      next: (res) => {
        this.commitResult.set(res);
        this.importStep.set('done');
        this.importing.set(false);
      },
      error: () => {
        this.importError.set('Error committing import.');
        this.importing.set(false);
      },
    });
  }

  statusBadgeClass(status: GuestStatus): string {
    const map: Record<GuestStatus, string> = {
      pending: 'bg-yellow-50 text-yellow-700 ring-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:ring-yellow-800',
      confirmed: 'bg-green-50 text-green-700 ring-green-200 dark:bg-green-950 dark:text-green-400 dark:ring-green-800',
      cancelled: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950 dark:text-red-400 dark:ring-red-800',
      arrived: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:ring-blue-800',
      blocked: 'bg-gray-50 text-gray-600 ring-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700',
    };
    return map[status];
  }
}
