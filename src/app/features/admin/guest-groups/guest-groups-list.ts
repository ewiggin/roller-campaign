import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { GuestGroupsService, ImportGroupResult } from '../../../core/services/guest-groups.service';
import { GuestsService } from '../../../core/services/guests.service';
import { RegionsService } from '../../../core/services/regions.service';
import { HostsService } from '../../../core/services/hosts.service';
import { AuthService } from '../../../core/services/auth.service';
import type { GuestGroup } from '../../../core/models/guest-group.model';
import type { Guest } from '../../../core/models/guest.model';
import type { Region } from '../../../core/models/region.model';
import type { Host } from '../../../core/models/host.model';

type ActiveModal = 'create' | 'guests' | 'import' | 'assign-host' | null;

@Component({
  selector: 'app-guest-groups-list',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './guest-groups-list.html',
})
export class GuestGroupsListComponent implements OnInit {
  private readonly svc = inject(GuestGroupsService);
  private readonly guestsSvc = inject(GuestsService);
  private readonly regionsSvc = inject(RegionsService);
  private readonly hostsSvc = inject(HostsService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly isSuperAdmin = this.auth.isSuperAdmin;

  readonly regions = signal<Region[]>([]);
  readonly groups = signal<GuestGroup[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly selectedRegionId = signal('');
  readonly total = signal(0);
  readonly page = signal(1);
  readonly limit = 50;
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.limit)));

  readonly activeModal = signal<ActiveModal>(null);
  readonly saving = signal(false);
  readonly formError = signal('');

  // Host assignment modal
  readonly hostAssignGroup = signal<GuestGroup | null>(null);
  readonly hosts = signal<Host[]>([]);
  readonly hostsLoading = signal(false);
  readonly selectedHostId = signal<string>('');
  readonly assigningHost = signal(false);

  // Import modal
  readonly importRegionId = signal('');
  readonly importing = signal(false);
  readonly importError = signal('');
  readonly importResult = signal<ImportGroupResult | null>(null);
  isDragging = false;

  // Guests modal
  readonly detailGroup = signal<GuestGroup | null>(null);
  readonly groupGuests = signal<Guest[]>([]);
  readonly guestsLoading = signal(false);
  readonly guestsError = signal('');

  readonly groupContact = computed(() =>
    this.groupGuests().find((g) => g.is_group_contact) ?? null,
  );
  readonly otherGuests = computed(() =>
    this.groupGuests().filter((g) => !g.is_group_contact),
  );

  readonly form = this.fb.nonNullable.group({
    group_code: ['', Validators.required],
    region_id: ['', Validators.required],
  });

  readonly regionName = computed(() => {
    const rid = this.selectedRegionId();
    return this.regions().find((r) => r.id === rid)?.name ?? '';
  });

  ngOnInit() {
    this.regionsSvc.getAll().subscribe({
      next: (r) => {
        this.regions.set(r);
        if (r.length > 0) {
          const firstId = r[0].id;
          this.selectedRegionId.set(firstId);
          this.form.patchValue({ region_id: firstId });
        }
        this.loadGroups();
      },
      error: () => {
        this.error.set('Error loading regions.');
        this.loading.set(false);
      },
    });
  }

  private loadGroups() {
    this.loading.set(true);
    this.svc.getAll({
      regionId: this.selectedRegionId() || undefined,
      page: this.page(),
      limit: this.limit,
    }).subscribe({
      next: (res) => {
        this.groups.set(res.data);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Error loading groups.');
        this.loading.set(false);
      },
    });
  }

  selectRegion(id: string) {
    this.selectedRegionId.set(id);
    this.page.set(1);
    this.loadGroups();
  }

  prevPage() {
    if (this.page() > 1) { this.page.update((p) => p - 1); this.loadGroups(); }
  }

  nextPage() {
    if (this.page() < this.totalPages()) { this.page.update((p) => p + 1); this.loadGroups(); }
  }

  openCreate() {
    this.form.reset({ group_code: '', region_id: this.selectedRegionId() });
    this.formError.set('');
    this.activeModal.set('create');
  }

  openAssignHost(group: GuestGroup) {
    this.hostAssignGroup.set(group);
    this.selectedHostId.set(group.host_id ?? '');
    this.hosts.set([]);
    this.hostsLoading.set(true);
    this.activeModal.set('assign-host');
    this.hostsSvc.getAll(group.region_id).subscribe({
      next: (h) => {
        this.hosts.set(h);
        this.hostsLoading.set(false);
      },
      error: () => this.hostsLoading.set(false),
    });
  }

  confirmAssignHost() {
    const group = this.hostAssignGroup();
    if (!group || this.assigningHost()) return;
    this.assigningHost.set(true);
    const hostId = this.selectedHostId() || null;
    this.svc.assignHost(group.id, hostId).subscribe({
      next: (updated) => {
        this.groups.update((list) => list.map((g) => (g.id === updated.id ? updated : g)));
        this.activeModal.set(null);
        this.assigningHost.set(false);
      },
      error: () => this.assigningHost.set(false),
    });
  }

  openImport() {
    this.importRegionId.set(this.selectedRegionId() || this.regions()[0]?.id || '');
    this.importError.set('');
    this.importResult.set(null);
    this.activeModal.set('import');
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
    if (file) this.doImport(file);
  }

  onFileSelected(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (file) this.doImport(file);
  }

  private doImport(file: File) {
    if (!this.importRegionId()) {
      this.importError.set('Select a region first.');
      return;
    }
    this.importing.set(true);
    this.importError.set('');
    this.importResult.set(null);
    this.svc.importFromExcel(file, this.importRegionId()).subscribe({
      next: (result) => {
        this.importResult.set(result);
        this.importing.set(false);
        this.loadGroups();
      },
      error: () => {
        this.importError.set('Error importing file. Check the format.');
        this.importing.set(false);
      },
    });
  }

  downloadTemplate() {
    this.svc.downloadTemplate().subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'plantilla-grupos.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  openGuests(group: GuestGroup) {
    this.detailGroup.set(group);
    this.groupGuests.set([]);
    this.guestsError.set('');
    this.guestsLoading.set(true);
    this.activeModal.set('guests');

    this.guestsSvc.getAll({ groupId: group.id, limit: 200 }).subscribe({
      next: (res) => {
        this.groupGuests.set(res.data);
        this.guestsLoading.set(false);
      },
      error: () => {
        this.guestsError.set('Error loading guests.');
        this.guestsLoading.set(false);
      },
    });
  }

  save() {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.formError.set('');
    this.svc.create(this.form.getRawValue()).subscribe({
      next: () => {
        this.activeModal.set(null);
        this.saving.set(false);
        this.loadGroups();
      },
      error: (err: { status?: number }) => {
        this.formError.set(err.status === 409 ? 'Group code already exists.' : 'Error saving group.');
        this.saving.set(false);
      },
    });
  }

  deleteGroup(group: GuestGroup) {
    if (!confirm(`Delete group "${group.group_code}"? This will fail if it has guests.`)) return;
    this.svc.remove(group.id).subscribe({
      next: () => this.loadGroups(),
      error: () => alert('Cannot delete group. It may have guests assigned.'),
    });
  }

  closeModal() {
    this.activeModal.set(null);
  }

  statusClass(status: Guest['status']): string {
    const map: Record<string, string> = {
      pending: 'bg-yellow-50 text-yellow-700 ring-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:ring-yellow-800',
      confirmed: 'bg-green-50 text-green-700 ring-green-200 dark:bg-green-950 dark:text-green-400 dark:ring-green-800',
      cancelled: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950 dark:text-red-400 dark:ring-red-800',
      arrived: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:ring-blue-800',
      blocked: 'bg-gray-50 text-gray-600 ring-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700',
    };
    return map[status] ?? '';
  }
}
