import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { catchError, concatMap, from, last, map, of, switchMap, take, toArray } from 'rxjs';
import type {
  Activity,
  ActivityStatus,
  AvailableCartForActivity,
  AvailableGroupForActivity,
  AvailableVolunteerForActivity,
  RepeatType,
  UpdateActivityPayload,
} from '../../../core/models/activity.model';
import type { Host } from '../../../core/models/host.model';
import type { Region } from '../../../core/models/region.model';
import { ActivitiesService } from '../../../core/services/activities.service';
import { HostsService } from '../../../core/services/hosts.service';
import { RegionsService } from '../../../core/services/regions.service';
import { StorageService } from '../../../core/services/storage.service';
import { VolunteersService } from '../../../core/services/volunteers.service';
import { downloadFile } from '../../../core/utils/download-file';
import { CalendarComponent } from '../../../shared/components/calendar/calendar';
import { EmojiPickerComponent } from '../../../shared/components/emoji-picker/emoji-picker';
import {
  LocationPickerComponent,
  type PlaceResult,
} from '../../../shared/components/location-picker/location-picker';
import { SearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select';
import { ActivityImportModalComponent } from './activity-import-modal';

type ActiveModal = 'create' | 'detail' | null;
type DetailTab = 'info' | 'volunteers' | 'groups' | 'preaching-groups';

interface LocationSlot {
  id: string;
  value: PlaceResult | null;
  description: string;
}

@Component({
  selector: 'app-activities-list',
  imports: [
    ReactiveFormsModule,
    FormsModule,
    DatePipe,
    SearchableSelectComponent,
    LocationPickerComponent,
    EmojiPickerComponent,
    CalendarComponent,
    ActivityImportModalComponent,
  ],
  templateUrl: './activities-list.html',
})
export class ActivitiesListComponent implements OnInit {
  private readonly svc = inject(ActivitiesService);
  private readonly regionsSvc = inject(RegionsService);
  private readonly hostsSvc = inject(HostsService);
  private readonly volunteersSvc = inject(VolunteersService);
  private readonly storageSvc = inject(StorageService);
  private readonly route = inject(ActivatedRoute);

  // When opened from the "Preaching Shifts" menu entry, the list is
  // pre-filtered to is_preaching_shift = true and new activities created
  // here are implicitly preaching shifts (no need for a manual toggle).
  readonly preachingShiftsOnly = this.route.snapshot.data['preachingShiftsOnly'] === true;

  private readonly storageKey = `roller-filter-activities-${this.preachingShiftsOnly ? 'preaching' : 'all'}`;

  readonly pageTitle = this.preachingShiftsOnly ? 'Preaching Shifts' : 'Activities';
  readonly newActivityLabel = this.preachingShiftsOnly ? 'New preaching shift' : 'New activity';
  readonly emptyActivitiesLabel = this.preachingShiftsOnly
    ? 'No preaching shifts found.'
    : 'No activities found.';

  // filter hosts (separate from modal hosts)
  readonly filterHosts = signal<Host[]>([]);
  readonly filterHost = signal('');
  private readonly fb = inject(FormBuilder);

  readonly regions = signal<Region[]>([]);
  readonly activities = signal<Activity[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly total = signal(0);
  readonly page = signal(1);
  readonly limit = 50;

  // ── View mode ─────────────────────────────────────────────────────────────

  readonly viewMode = signal<'list' | 'calendar'>('list');
  readonly calendarActivities = signal<Activity[]>([]);
  readonly calendarLoading = signal(false);
  private calendarPeriod: { dateFrom: string; dateTo: string } | null = null;

  // ── Bulk selection ────────────────────────────────────────────────────────

  readonly selectedIds = signal(new Set<string>());
  readonly bulkSaving = signal(false);

  readonly selectedCount = computed(() => this.selectedIds().size);

  readonly isAllSelected = computed(() => {
    const acts = this.filteredActivities();
    if (!acts.length) return false;
    const sel = this.selectedIds();
    return acts.every((a) => sel.has(a.id));
  });

  readonly selectedDraftCount = computed(() => {
    const sel = this.selectedIds();
    return this.activities().filter((a) => sel.has(a.id) && a.status === 'draft').length;
  });

  readonly selectedPublishedCount = computed(() => {
    const sel = this.selectedIds();
    return this.activities().filter((a) => sel.has(a.id) && a.status === 'published').length;
  });

  toggleSelection(id: string) {
    const next = new Set(this.selectedIds());
    next.has(id) ? next.delete(id) : next.add(id);
    this.selectedIds.set(next);
  }

  toggleSelectAll() {
    const acts = this.filteredActivities();
    const next = new Set(this.selectedIds());
    if (this.isAllSelected()) acts.forEach((a) => next.delete(a.id));
    else acts.forEach((a) => next.add(a.id));
    this.selectedIds.set(next);
  }

  clearSelection() {
    this.selectedIds.set(new Set());
  }

  // ── Import / Export ───────────────────────────────────────────────────────

  readonly importModalOpen = signal(false);
  readonly exporting = signal(false);

  exportAll() {
    this.exporting.set(true);
    this.svc
      .getAll({
        regionId: this.filterRegion() || undefined,
        name: this.filterName() || undefined,
        date: this.filterDate() || undefined,
        hostId: this.filterHost() || undefined,
        is_preaching_shift: this.preachingShiftsOnly ? true : undefined,
        limit: 10000,
      })
      .pipe(
        switchMap(res => {
          if (!res.data.length) return of([] as Activity[]);
          return from(res.data).pipe(
            concatMap(a => this.svc.getOne(a.id)),
            toArray(),
          );
        }),
      )
      .subscribe({
        next: async activities => {
          const blob = new Blob([JSON.stringify(activities, null, 2)], {
            type: 'application/json',
          });
          const parts: string[] = [this.preachingShiftsOnly ? 'turnos' : 'actividades'];
          const regionName = this.regions().find(r => r.id === this.filterRegion())?.name;
          if (regionName) parts.push(regionName.replace(/[^a-z0-9]/gi, '-').toLowerCase());
          const hostName = this.filterHosts().find(h => h.id === this.filterHost())?.name;
          if (hostName) parts.push(hostName.replace(/[^a-z0-9]/gi, '-').toLowerCase());
          if (this.filterDate()) parts.push(this.filterDate());
          parts.push(new Date().toISOString().slice(0, 10));
          await downloadFile(blob, `${parts.join('-')}.json`);
          this.exporting.set(false);
        },
        error: () => this.exporting.set(false),
      });
  }

  onImportDone() {
    this.importModalOpen.set(false);
    this.load();
    if (this.viewMode() === 'calendar' && this.calendarPeriod) {
      this.fetchCalendar(this.calendarPeriod);
    }
  }

  bulkPublish() {
    const ids = [...this.selectedIds()].filter(
      (id) => this.activities().find((a) => a.id === id)?.status === 'draft',
    );
    if (!ids.length) return;
    this.bulkSaving.set(true);
    from(ids)
      .pipe(
        concatMap((id) => this.svc.publish(id)),
        last(),
      )
      .subscribe({
        next: () => {
          this.bulkSaving.set(false);
          this.clearSelection();
          this.load();
        },
        error: () => this.bulkSaving.set(false),
      });
  }

  bulkUnpublish() {
    const ids = [...this.selectedIds()].filter(
      (id) => this.activities().find((a) => a.id === id)?.status === 'published',
    );
    if (!ids.length) return;
    this.bulkSaving.set(true);
    from(ids)
      .pipe(
        concatMap((id) => this.svc.unpublish(id)),
        last(),
      )
      .subscribe({
        next: () => {
          this.bulkSaving.set(false);
          this.clearSelection();
          this.load();
        },
        error: () => this.bulkSaving.set(false),
      });
  }

  bulkDelete() {
    const ids = [...this.selectedIds()];
    if (!ids.length) return;
    const label = this.preachingShiftsOnly
      ? ids.length > 1
        ? `${ids.length} preaching shifts`
        : 'this preaching shift'
      : ids.length > 1
        ? `${ids.length} activities`
        : 'this activity';
    if (!confirm(`Delete ${label}? This cannot be undone.`)) return;
    this.bulkSaving.set(true);
    from(ids)
      .pipe(
        concatMap((id) =>
          this.svc.remove(id).pipe(
            map(() => ({ id, ok: true as const })),
            catchError(() => of({ id, ok: false as const })),
          ),
        ),
        toArray(),
      )
      .subscribe((results) => {
        this.bulkSaving.set(false);
        const deletedIds = results.filter((r) => r.ok).map((r) => r.id);
        const failedCount = results.length - deletedIds.length;
        if (deletedIds.includes(this.selectedActivity()?.id ?? '')) this.activeModal.set(null);
        this.clearSelection();
        this.load();
        if (this.viewMode() === 'calendar')
          if (this.calendarPeriod) this.fetchCalendar(this.calendarPeriod);
        if (failedCount > 0) {
          alert(
            `${failedCount} of ${ids.length} could not be deleted (published activities must be unpublished first).`,
          );
        }
      });
  }

  readonly filterRegion = signal('');
  readonly filterStatus = signal<ActivityStatus | ''>('');
  readonly filterDate = signal('');
  readonly filterName = signal('');

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.limit)));

  readonly regionItems = computed(() =>
    this.regions().map((r) => ({ value: r.id, label: r.name })),
  );

  readonly filterHostItems = computed(() =>
    this.filterHosts().map((h) => ({ value: h.id, label: h.name, meta: h.address ?? undefined })),
  );

  readonly filteredActivities = computed(() => {
    const status = this.filterStatus();
    if (!status) return this.activities();
    return this.activities().filter((a) => a.status === status);
  });

  // ── Create modal ──────────────────────────────────────────────────────────

  readonly activeModal = signal<ActiveModal>(null);
  readonly saving = signal(false);
  readonly formError = signal('');
  readonly createIconValue = signal('');

  // Repeat
  readonly repeatEnabled = signal(false);
  readonly repeatType = signal<RepeatType>('daily');
  readonly repeatCount = signal(3);
  readonly createDate = signal('');

  readonly repeatPreviewDates = computed(() => {
    if (!this.repeatEnabled()) return [];
    const base = this.createDate();
    if (!base) return [];
    const type = this.repeatType();
    const count = Math.max(2, Math.min(30, this.repeatCount() || 2));
    const [y, m, d] = base.split('-').map(Number);
    const start = new Date(y, m - 1, d);
    return Array.from({ length: count }, (_, i) => {
      const cur = new Date(y, m - 1, d);
      if (type === 'daily') cur.setDate(start.getDate() + i);
      else if (type === 'weekly') cur.setDate(start.getDate() + i * 7);
      const dd = String(cur.getDate()).padStart(2, '0');
      const mm = String(cur.getMonth() + 1).padStart(2, '0');
      return `${cur.getFullYear()}-${mm}-${dd}`;
    });
  });

  readonly createForm = this.fb.group({
    region_id: ['', Validators.required],
    name: ['', Validators.required],
    date: ['', Validators.required],
    start_time: ['', [Validators.required, Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d$/)]],
    end_time: ['', [Validators.required, Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d$/)]],
    description: ['', Validators.maxLength(500)],
    host_id: [null as string | null],
    required_volunteers: [null as number | null, [Validators.min(1), Validators.max(999)]],
    max_guests: [null as number | null, [Validators.min(1)]],
    is_preaching_shift: [false],
    request_attendance: [false],
    preaching_groups_count: [null as number | null, [Validators.min(1), Validators.max(50)]],
  });

  readonly createDescLen = signal(0);

  readonly createActivitySlots = signal<LocationSlot[]>([
    { id: crypto.randomUUID(), value: null, description: '' },
  ]);
  readonly createActivityFromHost = signal(false);
  readonly createHostId = signal<string | null>(null);

  // ── Detail modal ──────────────────────────────────────────────────────────

  readonly selectedActivity = signal<Activity | null>(null);
  readonly detailTab = signal<DetailTab>('info');
  readonly detailSaving = signal(false);
  readonly detailError = signal('');
  readonly seriesChoiceVisible = signal(false);
  private pendingSavePayload: UpdateActivityPayload | null = null;
  readonly editIconValue = signal('');

  readonly editForm = this.fb.group({
    name: ['', Validators.required],
    date: ['', Validators.required],
    start_time: ['', [Validators.required, Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d$/)]],
    end_time: ['', [Validators.required, Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d$/)]],
    description: ['', Validators.maxLength(500)],
    host_id: [null as string | null],
    required_volunteers: [null as number | null, [Validators.min(1), Validators.max(999)]],
    max_guests: [null as number | null, [Validators.min(1)]],
    is_preaching_shift: [false],
    request_attendance: [false],
  });

  readonly editDescLen = signal(0);

  readonly editActivitySlots = signal<LocationSlot[]>([
    { id: crypto.randomUUID(), value: null, description: '' },
  ]);
  readonly editActivityFromHost = signal(false);
  readonly editHostId = signal<string | null>(null);

  // ── Image upload ──────────────────────────────────────────────────────────
  readonly imageUrl = signal<string | null>(null);
  readonly imageUploading = signal(false);
  readonly imageUploadPercent = signal(0);

  // ── Territory upload (per preaching group) ────────────────────────────────
  readonly territoryUrls = signal<Record<string, string>>({});
  readonly territoryUploading = signal<Record<string, boolean>>({});
  readonly territoryPercent = signal<Record<string, number>>({});

  territoryUrlFor(groupId: string): string | null {
    return this.territoryUrls()[groupId] ?? null;
  }
  territoryUploadingFor(groupId: string): boolean {
    return this.territoryUploading()[groupId] ?? false;
  }
  territoryPercentFor(groupId: string): number {
    return this.territoryPercent()[groupId] ?? 0;
  }

  // ── Hosts (shared for both modals) ────────────────────────────────────────

  readonly modalHosts = signal<Host[]>([]);
  readonly hostsLoading = signal(false);

  readonly modalHostItems = computed(() =>
    this.modalHosts().map((h) => ({
      value: h.id,
      label: h.name,
      meta: h.address ?? undefined,
    })),
  );

  readonly selectedCreateHost = computed(() => {
    const id = this.createHostId();
    return id ? (this.modalHosts().find((h) => h.id === id) ?? null) : null;
  });

  readonly selectedEditHost = computed(() => {
    const id = this.editHostId();
    return id ? (this.modalHosts().find((h) => h.id === id) ?? null) : null;
  });

  // ── Volunteers tab ────────────────────────────────────────────────────────

  readonly availableVolunteersList = signal<AvailableVolunteerForActivity[]>([]);
  readonly volunteersLoading = signal(false);
  readonly selectedVolunteerIds = signal<string[]>([]);
  readonly filterVolunteerRole = signal('');
  readonly allVolunteerRoles = signal<{ id: string; name: string }[]>([]);

  // ── Groups tab ────────────────────────────────────────────────────────────

  readonly availableGroups = signal<AvailableGroupForActivity[]>([]);
  readonly groupsLoading = signal(false);
  readonly selectedGroupIds = signal<string[]>([]);

  // ── Carts (preaching groups) ─────────────────────────────────────────────

  readonly availableCarts = signal<AvailableCartForActivity[]>([]);
  readonly cartsLoading = signal(false);

  readonly availableCartItems = computed(() =>
    this.availableCarts().map((c) => ({
      value: c.id,
      label: c.number,
      meta: c.host_name ?? undefined,
    })),
  );

  readonly availableVolunteerRoles = computed(() => this.allVolunteerRoles());

  readonly filteredVolunteersList = computed(() => {
    const role = this.filterVolunteerRole();
    if (!role) return this.availableVolunteersList();
    return this.availableVolunteersList().filter((v) => v.roles?.some((r) => r.id === role));
  });

  readonly availableVolunteerItems = computed(() =>
    this.filteredVolunteersList().map((v) => ({
      value: v.id,
      label: v.full_name,
      disabled: v.already_in_activity,
      meta: v.already_in_activity ? 'Already in another activity' : v.volunteer_code,
    })),
  );

  readonly availableGroupItems = computed(() => {
    const isPreachingShift = this.selectedActivity()?.is_preaching_shift ?? false;
    return this.availableGroups().map((g) => {
      const preachingLimitReached = isPreachingShift && g.preaching_shifts_count >= 3;
      return {
        value: g.id,
        label: g.group_code,
        disabled: g.already_in_activity || g.host_schedule_conflict || preachingLimitReached,
        meta: g.already_in_activity
          ? 'Already in another activity'
          : g.host_schedule_conflict
            ? 'Host meeting conflict'
            : preachingLimitReached
              ? `Max preaching shifts (${g.preaching_shifts_count}/3)`
              : [
                  g.distance_km !== null ? `${g.distance_km} km` : null,
                  g.host_name ?? null,
                  `${g.guest_count} guests`,
                ]
                  .filter(Boolean)
                  .join(' · '),
      };
    });
  });

  // ── Preaching groups tab ──────────────────────────────────────────────────

  readonly detailTabs = computed(() => {
    const isPreachingShift = this.selectedActivity()?.is_preaching_shift ?? false;
    return isPreachingShift
      ? ([['info', 'Info'] as const, ['preaching-groups', 'Preaching groups'] as const] as const)
      : ([
          ['info', 'Info'] as const,
          ['volunteers', 'Volunteers'] as const,
          ['groups', 'Groups'] as const,
        ] as const);
  });

  readonly pickRoleByGroup = signal<Record<string, string>>({});

  pickedRoleFor(groupId: string): string {
    return this.pickRoleByGroup()[groupId] ?? '';
  }

  setPickedRoleFor(groupId: string, value: string) {
    this.pickRoleByGroup.update((m) => ({ ...m, [groupId]: value }));
    // The selected volunteer may no longer match the new role filter
    this.setPickedVolunteerFor(groupId, '');
  }

  ungroupedVolunteerItemsFor(groupId: string) {
    const role = this.pickedRoleFor(groupId);
    return this.availableVolunteersList()
      .filter((v) => !v.already_in_activity)
      .filter((v) => !role || v.roles?.some((r) => r.id === role))
      .map((v) => ({ value: v.id, label: v.full_name, meta: v.volunteer_code }));
  }

  readonly ungroupedGroupItems = computed(() => {
    const isPreachingShift = this.selectedActivity()?.is_preaching_shift ?? false;
    return this.availableGroups()
      .filter(
        (g) =>
          !g.already_in_activity &&
          !g.host_schedule_conflict &&
          !(isPreachingShift && g.preaching_shifts_count >= 3) &&
          g.guest_count > 0,
      )
      .map((g) => ({
        value: g.id,
        label: g.group_code,
        meta: [
          g.distance_km !== null ? `${g.distance_km} km` : null,
          g.host_name ?? null,
          `${g.guest_count} guests`,
        ]
          .filter(Boolean)
          .join(' · '),
      }));
  });

  readonly pickVolunteerByGroup = signal<Record<string, string>>({});
  readonly pickGuestGroupByGroup = signal<Record<string, string[]>>({});
  readonly pickCartByGroup = signal<Record<string, string>>({});

  pickedVolunteerFor(groupId: string): string {
    return this.pickVolunteerByGroup()[groupId] ?? '';
  }

  setPickedVolunteerFor(groupId: string, value: string) {
    this.pickVolunteerByGroup.update((m) => ({ ...m, [groupId]: value }));
  }

  pickedGuestGroupFor(groupId: string): string[] {
    return this.pickGuestGroupByGroup()[groupId] ?? [];
  }

  setPickedGuestGroupFor(groupId: string, value: string[]) {
    this.pickGuestGroupByGroup.update((m) => ({ ...m, [groupId]: value }));
  }

  pickedCartFor(groupId: string): string {
    return this.pickCartByGroup()[groupId] ?? '';
  }

  setPickedCartFor(groupId: string, value: string) {
    this.pickCartByGroup.update((m) => ({ ...m, [groupId]: value }));
  }

  readonly expandedGroupIds = signal<Record<string, boolean>>({});

  isGroupExpanded(groupId: string): boolean {
    return this.expandedGroupIds()[groupId] ?? false;
  }

  toggleGroupExpanded(groupId: string) {
    this.expandedGroupIds.update((m) => ({ ...m, [groupId]: !this.isGroupExpanded(groupId) }));
  }

  private saveFilters() {
    sessionStorage.setItem(
      this.storageKey,
      JSON.stringify({
        region: this.filterRegion(),
        host: this.filterHost(),
        status: this.filterStatus(),
        date: this.filterDate(),
        name: this.filterName(),
      }),
    );
  }

  private loadSavedFilters() {
    try {
      const raw = sessionStorage.getItem(this.storageKey);
      if (!raw) return;
      const { region, host, status, date, name } = JSON.parse(raw);
      if (region) this.filterRegion.set(region);
      if (host) this.filterHost.set(host);
      if (status) this.filterStatus.set(status as ActivityStatus);
      if (date) this.filterDate.set(date);
      if (name) this.filterName.set(name);
    } catch {
      sessionStorage.removeItem(this.storageKey);
    }
  }

  clearFilters() {
    this.filterDate.set('');
    this.filterStatus.set('');
    this.filterHost.set('');
    this.filterName.set('');
    this.saveFilters();
    this.applyFilters();
  }

  onStatusFilterChange(status: string) {
    this.filterStatus.set(status as ActivityStatus | '');
    this.saveFilters();
  }

  ngOnInit() {
    this.loadSavedFilters();

    this.regionsSvc.getAll().subscribe({
      next: (r) => {
        this.regions.set(r);
        this.load();
      },
    });

    this.volunteersSvc.getRoles().subscribe({
      next: (roles) => this.allVolunteerRoles.set(roles),
    });

    this.createForm.get('date')!.valueChanges.subscribe((d) => this.createDate.set(d ?? ''));

    // Load hosts for filter whenever region filter changes
    this.hostsSvc
      .getAll(this.filterRegion() || undefined)
      .subscribe({ next: (h) => this.filterHosts.set(h) });

    this.createForm.get('region_id')!.valueChanges.subscribe((regionId) => {
      if (regionId) this.loadHostsForRegion(regionId);
      else this.modalHosts.set([]);
      this.createForm.patchValue({ host_id: null }, { emitEvent: false });
      this.createHostId.set(null);
      this.createActivityFromHost.set(false);
    });

    this.createForm.get('host_id')!.valueChanges.subscribe((hostId) => {
      this.createHostId.set(hostId ?? null);
      if (this.createActivityFromHost()) this.applyHostToLocation('create');
    });

    this.editForm.get('host_id')!.valueChanges.subscribe((hostId) => {
      this.editHostId.set(hostId ?? null);
      if (this.editActivityFromHost()) this.applyHostToLocation('edit');
    });
  }

  load() {
    this.loading.set(true);
    this.svc
      .getAll({
        regionId: this.filterRegion() || undefined,
        name: this.filterName() || undefined,
        date: this.filterDate() || undefined,
        hostId: this.filterHost() || undefined,
        is_preaching_shift: this.preachingShiftsOnly,
        page: this.page(),
        limit: this.limit,
      })
      .subscribe({
        next: (res) => {
          this.activities.set(res.data);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Error loading activities.');
          this.loading.set(false);
        },
      });
  }

  applyFilters() {
    this.page.set(1);
    this.clearSelection();
    this.load();
    if (this.viewMode() === 'calendar' && this.calendarPeriod)
      this.fetchCalendar(this.calendarPeriod);
    this.saveFilters();
  }

  onRegionFilterChange(regionId: string) {
    this.filterRegion.set(regionId);
    this.filterHost.set('');
    this.hostsSvc.getAll(regionId || undefined).subscribe({ next: (h) => this.filterHosts.set(h) });
    this.applyFilters();
  }

  prevPage() {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
      this.clearSelection();
      this.load();
    }
  }

  nextPage() {
    if (this.page() < this.totalPages()) {
      this.page.update((p) => p + 1);
      this.clearSelection();
      this.load();
    }
  }

  toggleLocationFromHost(form: 'create' | 'edit', checked: boolean) {
    if (form === 'create') this.createActivityFromHost.set(checked);
    else this.editActivityFromHost.set(checked);

    if (checked) {
      this.applyHostToLocation(form);
    } else {
      this.getActivitySlots(form).update((slots) =>
        slots.map((s, i) => (i === 0 ? { ...s, value: null } : s)),
      );
    }
  }

  private applyHostToLocation(form: 'create' | 'edit') {
    const host = form === 'create' ? this.selectedCreateHost() : this.selectedEditHost();
    if (!host?.address || host.lat === null || host.lng === null) return;
    const loc: PlaceResult = { address: host.address, lat: host.lat, lng: host.lng };
    this.getActivitySlots(form).update((slots) => {
      if (slots.length === 0) return [{ id: crypto.randomUUID(), value: loc, description: '' }];
      return slots.map((s, i) => (i === 0 ? { ...s, value: loc } : s));
    });
  }

  private getActivitySlots(form: 'create' | 'edit') {
    return form === 'create' ? this.createActivitySlots : this.editActivitySlots;
  }

  addLocationSlot(form: 'create' | 'edit') {
    this.getActivitySlots(form).update((slots) => [
      ...slots,
      { id: crypto.randomUUID(), value: null, description: '' },
    ]);
  }

  removeLocationSlot(form: 'create' | 'edit', index: number) {
    this.getActivitySlots(form).update((slots) => slots.filter((_, i) => i !== index));
  }

  onLocationSlotChange(form: 'create' | 'edit', index: number, result: PlaceResult | null) {
    this.getActivitySlots(form).update((slots) =>
      slots.map((s, i) => (i === index ? { ...s, value: result } : s)),
    );
  }

  onLocationDescriptionChange(form: 'create' | 'edit', index: number, desc: string) {
    this.getActivitySlots(form).update((slots) =>
      slots.map((s, i) => (i === index ? { ...s, description: desc } : s)),
    );
  }

  // ── Calendar ──────────────────────────────────────────────────────────────

  switchView(mode: 'list' | 'calendar') {
    this.viewMode.set(mode);
  }

  onPeriodChange(period: { dateFrom: string; dateTo: string }) {
    this.calendarPeriod = period;
    this.fetchCalendar(period);
  }

  private fetchCalendar(period: { dateFrom: string; dateTo: string }) {
    this.calendarLoading.set(true);
    this.svc
      .getAll({
        regionId: this.filterRegion() || undefined,
        name: this.filterName() || undefined,
        hostId: this.filterHost() || undefined,
        is_preaching_shift: this.preachingShiftsOnly,
        dateFrom: period.dateFrom,
        dateTo: period.dateTo,
        limit: 500,
      })
      .subscribe({
        next: (res) => {
          this.calendarActivities.set(res.data);
          this.calendarLoading.set(false);
        },
        error: () => this.calendarLoading.set(false),
      });
  }

  private loadHostsForRegion(regionId: string) {
    this.hostsLoading.set(true);
    this.hostsSvc.getAll(regionId).subscribe({
      next: (hosts) => {
        this.modalHosts.set(hosts);
        this.hostsLoading.set(false);
      },
      error: () => this.hostsLoading.set(false),
    });
  }

  // ── Create ────────────────────────────────────────────────────────────────

  openCreate() {
    const regionId = this.filterRegion() || this.regions()[0]?.id || '';
    this.createForm.reset({ region_id: regionId });
    this.createIconValue.set('');
    this.createDescLen.set(0);
    this.repeatEnabled.set(false);
    this.repeatType.set('daily');
    this.repeatCount.set(3);
    this.createDate.set('');
    this.createActivitySlots.set([{ id: crypto.randomUUID(), value: null, description: '' }]);
    this.createActivityFromHost.set(false);
    this.createHostId.set(null);
    this.formError.set('');
    if (regionId) this.loadHostsForRegion(regionId);
    this.activeModal.set('create');
  }

  submitCreate() {
    this.createForm.markAllAsTouched();
    if (this.createForm.invalid) return;
    this.saving.set(true);
    this.formError.set('');
    const v = this.createForm.getRawValue();
    const activityLocs = this.createActivitySlots()
      .filter((s) => s.value !== null)
      .map((s) => ({ ...s.value!, description: s.description || null }));

    const basePayload = {
      region_id: v.region_id!,
      name: v.name!,
      icon: this.createIconValue() || null,
      description: v.description || null,
      host_id: v.host_id || null,
      required_volunteers: v.required_volunteers || null,
      max_guests: v.max_guests || null,
      date: v.date!,
      start_time: v.start_time!,
      end_time: v.end_time!,
      activity_locations: activityLocs.length > 0 ? activityLocs : null,
      request_attendance: v.request_attendance ?? false,
      is_preaching_shift: this.preachingShiftsOnly,
    };

    const groupsToCreate =
      this.preachingShiftsOnly && this.createForm.value.preaching_groups_count
        ? this.createForm.value.preaching_groups_count
        : 0;

    const addGroups = (activityId: string): ReturnType<typeof this.svc.getOne> =>
      from(Array(groupsToCreate).fill(null)).pipe(
        concatMap(() => this.svc.addPreachingGroup(activityId)),
        last(),
        switchMap(() => this.svc.getOne(activityId)),
      );

    const afterCreate = (activity: Activity): ReturnType<typeof this.svc.getOne> =>
      groupsToCreate > 0 ? addGroups(activity.id) : of(activity);

    if (this.repeatEnabled()) {
      this.svc
        .createBatch({
          ...basePayload,
          repetition: { type: this.repeatType(), count: this.repeatCount() },
        })
        .pipe(
          switchMap((activities) =>
            groupsToCreate > 0
              ? from(activities).pipe(
                  concatMap((a) => addGroups(a.id)),
                  last(),
                )
              : activities[0]
                ? of(activities[0])
                : of(null as unknown as Activity),
          ),
        )
        .subscribe({
          next: (first) => {
            this.saving.set(false);
            this.activeModal.set(null);
            this.load();
            if (this.viewMode() === 'calendar')
              if (this.calendarPeriod) this.fetchCalendar(this.calendarPeriod);
            if (first) this.openDetail(first);
          },
          error: () => {
            this.formError.set('Error creating activities.');
            this.saving.set(false);
          },
        });
    } else {
      this.svc
        .create(basePayload)
        .pipe(switchMap((activity) => afterCreate(activity)))
        .subscribe({
          next: (activity) => {
            this.saving.set(false);
            this.activeModal.set(null);
            this.load();
            if (this.viewMode() === 'calendar')
              if (this.calendarPeriod) this.fetchCalendar(this.calendarPeriod);
            this.openDetail(activity);
          },
          error: () => {
            this.formError.set('Error creating activity.');
            this.saving.set(false);
          },
        });
    }
  }

  // ── Detail ────────────────────────────────────────────────────────────────

  loadAndOpenDetail(id: string) {
    this.svc.getOne(id).subscribe({
      next: (activity) => this.openDetail(activity),
      error: () => this.error.set('Error loading activity.'),
    });
  }

  openDetail(activity: Activity) {
    this.selectedActivity.set(activity);
    this.detailTab.set('info');
    this.detailError.set('');
    this.imageUrl.set(null);
    this.imageUploading.set(false);
    this.imageUploadPercent.set(0);
    if (activity.image_key) {
      this.storageSvc
        .getDownloadPresignedUrl(activity.image_key, 3600)
        .pipe(take(1))
        .subscribe({ next: ({ url }) => this.imageUrl.set(url) });
    }
    this.territoryUrls.set({});
    this.territoryUploading.set({});
    this.territoryPercent.set({});
    this.loadTerritoryUrls(activity);
    this.editIconValue.set(activity.icon ?? '');
    this.editForm.patchValue({
      name: activity.name,
      date: activity.date,
      start_time: activity.start_time,
      end_time: activity.end_time,
      description: activity.description ?? '',
      host_id: activity.host_id,
      required_volunteers: activity.required_volunteers,
      max_guests: activity.max_guests,
      is_preaching_shift: activity.is_preaching_shift,
      request_attendance: activity.request_attendance,
    });
    this.editDescLen.set(activity.description?.length ?? 0);
    this.editActivitySlots.set(
      (activity.activity_locations?.length ? activity.activity_locations : [null]).map((v) => ({
        id: crypto.randomUUID(),
        value: v ? { address: v.address, lat: v.lat, lng: v.lng } : null,
        description: v?.description ?? '',
      })),
    );
    this.editActivityFromHost.set(false);
    this.editHostId.set(activity.host_id);
    this.selectedVolunteerIds.set([]);
    this.selectedGroupIds.set([]);
    this.filterVolunteerRole.set('');
    this.pickVolunteerByGroup.set({});
    this.pickGuestGroupByGroup.set({});
    this.pickCartByGroup.set({});
    this.pickRoleByGroup.set({});
    this.expandedGroupIds.set({});
    this.activeModal.set('detail');
    this.loadHostsForRegion(activity.region_id);
    this.loadRegionData(activity);
  }

  private loadRegionData(activity: Activity) {
    this.volunteersLoading.set(true);
    this.groupsLoading.set(true);
    this.svc.getAvailableVolunteers(activity.id).subscribe({
      next: (vs) => {
        this.availableVolunteersList.set(vs);
        this.volunteersLoading.set(false);
      },
      error: () => this.volunteersLoading.set(false),
    });
    this.svc.getAvailableGroups(activity.id).subscribe({
      next: (groups) => {
        this.availableGroups.set(groups);
        this.groupsLoading.set(false);
      },
      error: () => this.groupsLoading.set(false),
    });
    if (activity.is_preaching_shift) this.reloadAvailableCarts();
  }

  reloadAvailableVolunteers() {
    const activity = this.selectedActivity();
    if (!activity) return;
    this.volunteersLoading.set(true);
    this.svc.getAvailableVolunteers(activity.id).subscribe({
      next: (vs) => {
        this.availableVolunteersList.set(vs);
        this.volunteersLoading.set(false);
      },
      error: () => this.volunteersLoading.set(false),
    });
  }

  reloadAvailableGroups() {
    const activity = this.selectedActivity();
    if (!activity) return;
    this.groupsLoading.set(true);
    this.svc.getAvailableGroups(activity.id).subscribe({
      next: (groups) => {
        this.availableGroups.set(groups);
        this.groupsLoading.set(false);
      },
      error: () => this.groupsLoading.set(false),
    });
  }

  reloadAvailableCarts() {
    const activity = this.selectedActivity();
    if (!activity) return;
    this.cartsLoading.set(true);
    this.svc.getAvailableCarts(activity.id).subscribe({
      next: (carts) => {
        this.availableCarts.set(carts);
        this.cartsLoading.set(false);
      },
      error: () => this.cartsLoading.set(false),
    });
  }

  saveInfo() {
    this.editForm.markAllAsTouched();
    if (this.editForm.invalid) return;
    const activity = this.selectedActivity();
    if (!activity) return;

    const payload = this.buildSavePayload();

    if (activity.series_id) {
      this.pendingSavePayload = payload;
      this.seriesChoiceVisible.set(true);
    } else {
      this.executeSave(payload);
    }
  }

  confirmSaveOnlyThis() {
    if (!this.pendingSavePayload) return;
    this.seriesChoiceVisible.set(false);
    this.executeSave({ ...this.pendingSavePayload, detach_from_series: true });
    this.pendingSavePayload = null;
  }

  confirmSaveFuture() {
    if (!this.pendingSavePayload) return;
    this.seriesChoiceVisible.set(false);
    this.executeSeriesUpdate(this.pendingSavePayload);
    this.pendingSavePayload = null;
  }

  cancelSeriesChoice() {
    this.seriesChoiceVisible.set(false);
    this.pendingSavePayload = null;
  }

  private buildSavePayload(): UpdateActivityPayload {
    const v = this.editForm.getRawValue();
    const activityLocs = this.editActivitySlots()
      .filter((s) => s.value !== null)
      .map((s) => ({ ...s.value!, description: s.description || null }));
    return {
      name: v.name!,
      icon: this.editIconValue() || null,
      date: v.date!,
      start_time: v.start_time!,
      end_time: v.end_time!,
      description: v.description || null,
      host_id: v.host_id || null,
      required_volunteers: v.required_volunteers || null,
      max_guests: v.max_guests || null,
      activity_locations: activityLocs.length > 0 ? activityLocs : null,
      request_attendance: v.request_attendance ?? false,
      is_preaching_shift: this.selectedActivity()?.is_preaching_shift ?? false,
    };
  }

  onImageSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    const activity = this.selectedActivity();
    if (!file || !activity) return;

    const key = this.storageSvc.buildKey('activities', file.name);
    this.imageUploading.set(true);
    this.imageUploadPercent.set(0);

    this.storageSvc.uploadFile(key, file).subscribe({
      next: ({ progress }) => this.imageUploadPercent.set(progress.percent),
      error: () => {
        this.imageUploading.set(false);
        this.detailError.set('Error uploading image.');
      },
      complete: () => {
        this.svc
          .update(activity.id, { image_key: key })
          .pipe(
            switchMap((updated) => {
              this.selectedActivity.set(updated);
              return this.storageSvc.getDownloadPresignedUrl(key, 3600);
            }),
          )
          .subscribe({
            next: ({ url }) => {
              this.imageUrl.set(url);
              this.imageUploading.set(false);
              this.load();
            },
            error: () => {
              this.imageUploading.set(false);
              this.detailError.set('Error saving image.');
            },
          });
      },
    });
  }

  removeImage() {
    const activity = this.selectedActivity();
    if (!activity?.image_key) return;
    this.svc.update(activity.id, { image_key: null }).subscribe({
      next: (updated) => {
        this.selectedActivity.set(updated);
        this.imageUrl.set(null);
        this.load();
      },
      error: () => this.detailError.set('Error removing image.'),
    });
  }

  private loadTerritoryUrls(activity: Activity) {
    for (const group of activity.preaching_groups ?? []) {
      if (!group.territory_key) continue;
      this.storageSvc
        .getDownloadPresignedUrl(group.territory_key, 3600)
        .pipe(take(1))
        .subscribe({
          next: ({ url }) => this.territoryUrls.update((prev) => ({ ...prev, [group.id]: url })),
        });
    }
  }

  onTerritorySelected(groupId: string, event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    const activity = this.selectedActivity();
    if (!file || !activity) return;

    const key = this.storageSvc.buildKey('territories', file.name);
    this.territoryUploading.update((prev) => ({ ...prev, [groupId]: true }));
    this.territoryPercent.update((prev) => ({ ...prev, [groupId]: 0 }));

    this.storageSvc.uploadFile(key, file).subscribe({
      next: ({ progress }) =>
        this.territoryPercent.update((prev) => ({ ...prev, [groupId]: progress.percent })),
      error: () => {
        this.territoryUploading.update((prev) => ({ ...prev, [groupId]: false }));
        this.detailError.set('Error uploading territory.');
      },
      complete: () => {
        this.svc
          .updatePreachingGroupTerritory(activity.id, groupId, key)
          .pipe(
            switchMap((updated) => {
              this.selectedActivity.set(updated);
              return this.storageSvc.getDownloadPresignedUrl(key, 3600);
            }),
          )
          .subscribe({
            next: ({ url }) => {
              this.territoryUrls.update((prev) => ({ ...prev, [groupId]: url }));
              this.territoryUploading.update((prev) => ({ ...prev, [groupId]: false }));
            },
            error: () => {
              this.territoryUploading.update((prev) => ({ ...prev, [groupId]: false }));
              this.detailError.set('Error saving territory.');
            },
          });
      },
    });
  }

  removeTerritory(groupId: string) {
    const activity = this.selectedActivity();
    if (!activity) return;
    this.svc.updatePreachingGroupTerritory(activity.id, groupId, null).subscribe({
      next: (updated) => {
        this.selectedActivity.set(updated);
        this.territoryUrls.update((prev) => {
          const next = { ...prev };
          delete next[groupId];
          return next;
        });
      },
      error: () => this.detailError.set('Error removing territory.'),
    });
  }

  private executeSave(payload: UpdateActivityPayload) {
    const activity = this.selectedActivity();
    if (!activity) return;
    this.detailSaving.set(true);
    this.detailError.set('');
    this.svc.update(activity.id, payload).subscribe({
      next: (updated) => {
        this.selectedActivity.set(updated);
        this.detailSaving.set(false);
        this.activeModal.set(null);
        this.load();
        if (this.calendarPeriod) this.fetchCalendar(this.calendarPeriod);
      },
      error: () => {
        this.detailError.set('Error saving changes.');
        this.detailSaving.set(false);
      },
    });
  }

  private executeSeriesUpdate(payload: UpdateActivityPayload) {
    const activity = this.selectedActivity();
    if (!activity) return;
    this.detailSaving.set(true);
    this.detailError.set('');
    this.svc.updateSeriesFromDate(activity.id, payload).subscribe({
      next: (updated) => {
        this.selectedActivity.set(updated);
        this.detailSaving.set(false);
        this.activeModal.set(null);
        this.load();
        if (this.calendarPeriod) this.fetchCalendar(this.calendarPeriod);
      },
      error: () => {
        this.detailError.set('Error updating series.');
        this.detailSaving.set(false);
      },
    });
  }

  togglePublish() {
    const activity = this.selectedActivity();
    if (!activity) return;
    this.detailSaving.set(true);
    const req =
      activity.status === 'published'
        ? this.svc.unpublish(activity.id)
        : this.svc.publish(activity.id);
    req.subscribe({
      next: (updated) => {
        this.selectedActivity.set(updated);
        this.detailSaving.set(false);
        this.load();
      },
      error: () => {
        this.detailError.set('Error updating status.');
        this.detailSaving.set(false);
      },
    });
  }

  // ── Volunteers ────────────────────────────────────────────────────────────

  addVolunteers() {
    const ids = this.selectedVolunteerIds();
    const activity = this.selectedActivity();
    if (!ids.length || !activity) return;
    this.detailSaving.set(true);
    const roleId = this.filterVolunteerRole() || null;
    from(ids)
      .pipe(
        concatMap((id) => this.svc.assignVolunteer(activity.id, id, roleId)),
        last(),
      )
      .subscribe({
        next: (updated) => {
          this.selectedActivity.set(updated);
          this.selectedVolunteerIds.set([]);
          this.detailSaving.set(false);
          this.reloadAvailableVolunteers();
          this.load();
        },
        error: () => {
          this.detailError.set('Error assigning volunteers.');
          this.detailSaving.set(false);
        },
      });
  }

  setVolunteerRole(volunteerId: string, roleId: string) {
    const activity = this.selectedActivity();
    if (!activity) return;
    this.detailSaving.set(true);
    this.svc.setVolunteerRole(activity.id, volunteerId, roleId || null).subscribe({
      next: (updated) => {
        this.selectedActivity.set(updated);
        this.detailSaving.set(false);
      },
      error: () => {
        this.detailError.set('Error setting role.');
        this.detailSaving.set(false);
      },
    });
  }

  removeVolunteer(volunteerId: string) {
    const activity = this.selectedActivity();
    if (!activity) return;
    this.detailSaving.set(true);
    this.svc.unassignVolunteer(activity.id, volunteerId).subscribe({
      next: (updated) => {
        this.selectedActivity.set(updated);
        this.detailSaving.set(false);
        this.load();
      },
      error: () => {
        this.detailError.set('Error removing volunteer.');
        this.detailSaving.set(false);
      },
    });
  }

  // ── Groups ────────────────────────────────────────────────────────────────

  addGroups() {
    const ids = this.selectedGroupIds();
    const activity = this.selectedActivity();
    if (!ids.length || !activity) return;
    this.detailSaving.set(true);
    from(ids)
      .pipe(
        concatMap((id) => this.svc.assignGuestGroup(activity.id, id)),
        last(),
      )
      .subscribe({
        next: (updated) => {
          this.selectedActivity.set(updated);
          this.selectedGroupIds.set([]);
          this.detailSaving.set(false);
          this.reloadAvailableGroups();
          this.load();
        },
        error: () => {
          this.detailError.set('Error assigning groups.');
          this.detailSaving.set(false);
        },
      });
  }

  removeGroup(groupId: string) {
    const activity = this.selectedActivity();
    if (!activity) return;
    this.detailSaving.set(true);
    this.svc.unassignGuestGroup(activity.id, groupId).subscribe({
      next: (updated) => {
        this.selectedActivity.set(updated);
        this.detailSaving.set(false);
        this.reloadAvailableGroups();
        this.load();
      },
      error: () => {
        this.detailError.set('Error removing group.');
        this.detailSaving.set(false);
      },
    });
  }

  assignFromRequest(groupId: string, requestId: string) {
    const activity = this.selectedActivity();
    if (!activity) return;
    this.detailSaving.set(true);
    this.svc.assignGuestGroup(activity.id, groupId).subscribe({
      next: (updated) => {
        this.selectedActivity.set(updated);
        this.detailSaving.set(false);
        this.reloadAvailableGroups();
        this.load();
      },
      error: (err) => {
        this.detailError.set(err?.error?.message ?? 'Error assigning group.');
        this.detailSaving.set(false);
      },
    });
  }

  deleteRequest(requestId: string) {
    const activity = this.selectedActivity();
    if (!activity) return;
    this.detailSaving.set(true);
    this.svc.deleteAttendanceRequest(activity.id, requestId).subscribe({
      next: (updated) => {
        this.selectedActivity.set(updated);
        this.detailSaving.set(false);
      },
      error: () => {
        this.detailError.set('Error deleting request.');
        this.detailSaving.set(false);
      },
    });
  }

  // ── Preaching groups ──────────────────────────────────────────────────────

  addPreachingGroup() {
    const activity = this.selectedActivity();
    if (!activity) return;
    const previousIds = new Set((activity.preaching_groups ?? []).map((g) => g.id));
    this.detailSaving.set(true);
    this.svc.addPreachingGroup(activity.id).subscribe({
      next: (updated) => {
        this.selectedActivity.set(updated);
        const created = (updated.preaching_groups ?? []).find((g) => !previousIds.has(g.id));
        if (created) {
          this.expandedGroupIds.update((m) => ({ ...m, [created.id]: true }));
        }
        this.detailSaving.set(false);
      },
      error: () => {
        this.detailError.set('Error creating group.');
        this.detailSaving.set(false);
      },
    });
  }

  renamePreachingGroup(groupId: string, name: string) {
    const activity = this.selectedActivity();
    if (!activity) return;
    this.svc.renamePreachingGroup(activity.id, groupId, name.trim() || null).subscribe({
      next: (updated) => this.selectedActivity.set(updated),
      error: () => this.detailError.set('Error renaming group.'),
    });
  }

  removePreachingGroup(groupId: string) {
    const activity = this.selectedActivity();
    if (!activity) return;
    if (!confirm('Delete this preaching group? Its members will be unassigned from the activity.'))
      return;
    this.detailSaving.set(true);
    this.svc.removePreachingGroup(activity.id, groupId).subscribe({
      next: (updated) => {
        this.selectedActivity.set(updated);
        this.detailSaving.set(false);
        this.reloadAvailableVolunteers();
        this.reloadAvailableGroups();
        this.load();
      },
      error: () => {
        this.detailError.set('Error deleting group.');
        this.detailSaving.set(false);
      },
    });
  }

  addVolunteerToGroup(groupId: string) {
    const activity = this.selectedActivity();
    const volunteerId = this.pickedVolunteerFor(groupId);
    if (!activity || !volunteerId) return;
    const roleId = this.pickedRoleFor(groupId) || null;
    this.detailSaving.set(true);
    this.svc.assignVolunteerToGroup(activity.id, groupId, volunteerId, roleId).subscribe({
      next: (updated) => {
        this.selectedActivity.set(updated);
        this.setPickedVolunteerFor(groupId, '');
        this.detailSaving.set(false);
        this.reloadAvailableVolunteers();
        this.load();
      },
      error: () => {
        this.detailError.set('Error assigning volunteer.');
        this.detailSaving.set(false);
      },
    });
  }

  updateGroupVolunteerDescription(groupId: string, volunteerId: string, description: string) {
    const activity = this.selectedActivity();
    if (!activity) return;
    this.svc
      .updateGroupVolunteerDescription(
        activity.id,
        groupId,
        volunteerId,
        description.trim() || null,
      )
      .subscribe({
        next: (updated) => this.selectedActivity.set(updated),
        error: () => this.detailError.set('Error updating description.'),
      });
  }

  removeVolunteerFromGroup(groupId: string, volunteerId: string) {
    const activity = this.selectedActivity();
    if (!activity) return;
    this.detailSaving.set(true);
    this.svc.removeVolunteerFromGroup(activity.id, groupId, volunteerId).subscribe({
      next: (updated) => {
        this.selectedActivity.set(updated);
        this.detailSaving.set(false);
        this.reloadAvailableVolunteers();
        this.load();
      },
      error: () => {
        this.detailError.set('Error removing volunteer.');
        this.detailSaving.set(false);
      },
    });
  }

  addGuestGroupToGroup(groupId: string) {
    const activity = this.selectedActivity();
    const guestGroupIds = this.pickedGuestGroupFor(groupId);
    if (!activity || !guestGroupIds.length) return;
    this.detailSaving.set(true);
    from(guestGroupIds)
      .pipe(
        concatMap((guestGroupId) =>
          this.svc.assignGuestGroupToGroup(activity.id, groupId, guestGroupId),
        ),
        last(),
      )
      .subscribe({
        next: (updated) => {
          this.selectedActivity.set(updated);
          this.setPickedGuestGroupFor(groupId, []);
          this.detailSaving.set(false);
          this.reloadAvailableGroups();
          this.load();
        },
        error: () => {
          this.detailError.set('Error assigning group.');
          this.detailSaving.set(false);
        },
      });
  }

  removeGuestGroupFromGroup(groupId: string, guestGroupId: string) {
    const activity = this.selectedActivity();
    if (!activity) return;
    this.detailSaving.set(true);
    this.svc.removeGuestGroupFromGroup(activity.id, groupId, guestGroupId).subscribe({
      next: (updated) => {
        this.selectedActivity.set(updated);
        this.detailSaving.set(false);
        this.reloadAvailableGroups();
        this.load();
      },
      error: () => {
        this.detailError.set('Error removing group.');
        this.detailSaving.set(false);
      },
    });
  }

  addCartToGroup(groupId: string) {
    const activity = this.selectedActivity();
    const cartId = this.pickedCartFor(groupId);
    if (!activity || !cartId) return;
    this.detailSaving.set(true);
    this.svc.assignCartToGroup(activity.id, groupId, cartId).subscribe({
      next: (updated) => {
        this.selectedActivity.set(updated);
        this.setPickedCartFor(groupId, '');
        this.detailSaving.set(false);
        this.reloadAvailableCarts();
      },
      error: (err: HttpErrorResponse) => {
        this.detailError.set(err.error?.message ?? 'Error assigning cart.');
        this.detailSaving.set(false);
      },
    });
  }

  removeCartFromGroup(groupId: string, cartId: string) {
    const activity = this.selectedActivity();
    if (!activity) return;
    this.detailSaving.set(true);
    this.svc.removeCartFromGroup(activity.id, groupId, cartId).subscribe({
      next: (updated) => {
        this.selectedActivity.set(updated);
        this.detailSaving.set(false);
        this.reloadAvailableCarts();
      },
      error: () => {
        this.detailError.set('Error removing cart.');
        this.detailSaving.set(false);
      },
    });
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  deleteActivity(activity: Activity) {
    if (!confirm(`Delete "${activity.name || activity.date}"?`)) return;
    this.svc.remove(activity.id).subscribe({
      next: () => {
        if (this.selectedActivity()?.id === activity.id) this.activeModal.set(null);
        this.load();
        if (this.viewMode() === 'calendar')
          if (this.calendarPeriod) this.fetchCalendar(this.calendarPeriod);
      },
      error: () => alert('Error deleting activity.'),
    });
  }

  deleteSeriesFromHere(activity: Activity) {
    if (
      !confirm(
        `Delete "${activity.name || activity.date}" and all future activities in this series?`,
      )
    )
      return;
    this.svc.removeSeriesFromDate(activity.id).subscribe({
      next: () => {
        this.activeModal.set(null);
        this.load();
        if (this.viewMode() === 'calendar')
          if (this.calendarPeriod) this.fetchCalendar(this.calendarPeriod);
      },
      error: () => alert('Error deleting series.'),
    });
  }

  closeModal() {
    this.activeModal.set(null);
    this.seriesChoiceVisible.set(false);
    this.pendingSavePayload = null;
  }

  statusBadgeClass(status: ActivityStatus): string {
    return status === 'published'
      ? 'bg-green-50 text-green-700 ring-green-200 dark:bg-green-950 dark:text-green-400 dark:ring-green-800'
      : 'bg-gray-50 text-gray-600 ring-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700';
  }

  setDetailTab(tab: string) {
    this.detailTab.set(tab as DetailTab);
  }

  formatRepeatDate(iso: string): string {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  }

  isInvalid(form: 'create' | 'edit', field: string): boolean {
    const c = form === 'create' ? this.createForm.get(field) : this.editForm.get(field);
    return !!(c?.invalid && c?.touched);
  }
}
