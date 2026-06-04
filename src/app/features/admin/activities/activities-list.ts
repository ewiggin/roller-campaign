import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { concatMap, from, last } from 'rxjs';
import type {
  Activity,
  ActivityStatus,
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
import { CalendarComponent } from '../../../shared/components/calendar/calendar';
import { EmojiPickerComponent } from '../../../shared/components/emoji-picker/emoji-picker';
import {
  LocationPickerComponent,
  type PlaceResult,
} from '../../../shared/components/location-picker/location-picker';
import { SearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select';

type ActiveModal = 'create' | 'detail' | null;
type DetailTab = 'info' | 'volunteers' | 'groups';

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
  ],
  templateUrl: './activities-list.html',
})
export class ActivitiesListComponent implements OnInit {
  private readonly svc = inject(ActivitiesService);
  private readonly regionsSvc = inject(RegionsService);
  private readonly hostsSvc = inject(HostsService);

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

  readonly filterRegion = signal('');
  readonly filterStatus = signal<ActivityStatus | ''>('');
  readonly filterDate = signal('');

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
  });

  readonly createDescLen = signal(0);

  readonly createActivityLocation = signal<PlaceResult | null>(null);
  readonly createActivityFromHost = signal(false);
  readonly createDepartureLocation = signal<PlaceResult | null>(null);
  readonly createDepartureFromHost = signal(false);
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
  });

  readonly editDescLen = signal(0);

  readonly editActivityLocation = signal<PlaceResult | null>(null);
  readonly editActivityFromHost = signal(false);
  readonly editDepartureLocation = signal<PlaceResult | null>(null);
  readonly editDepartureFromHost = signal(false);
  readonly editHostId = signal<string | null>(null);

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

  // ── Groups tab ────────────────────────────────────────────────────────────

  readonly availableGroups = signal<AvailableGroupForActivity[]>([]);
  readonly groupsLoading = signal(false);
  readonly selectedGroupIds = signal<string[]>([]);

  readonly availableVolunteerItems = computed(() =>
    this.availableVolunteersList().map((v) => ({
      value: v.id,
      label: v.full_name,
      disabled: v.already_in_activity,
      meta: v.already_in_activity ? 'Already in another activity' : v.volunteer_code,
    })),
  );

  readonly availableGroupItems = computed(() =>
    this.availableGroups().map((g) => ({
      value: g.id,
      label: g.group_code,
      disabled: g.already_in_activity || g.host_schedule_conflict,
      meta: g.already_in_activity
        ? 'Already in another activity'
        : g.host_schedule_conflict
          ? 'Host meeting conflict'
          : [
              g.distance_km !== null ? `${g.distance_km} km` : null,
              g.host_name ?? null,
              `${g.guest_count} guests`,
            ]
              .filter(Boolean)
              .join(' · '),
    })),
  );

  ngOnInit() {
    this.regionsSvc.getAll().subscribe({
      next: (r) => {
        this.regions.set(r);
        this.load();
      },
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
      this.createDepartureFromHost.set(false);
    });

    this.createForm.get('host_id')!.valueChanges.subscribe((hostId) => {
      this.createHostId.set(hostId ?? null);
      if (this.createDepartureFromHost()) this.applyHostToLocation('create', 'departure');
      if (this.createActivityFromHost()) this.applyHostToLocation('create', 'activity');
    });

    this.editForm.get('host_id')!.valueChanges.subscribe((hostId) => {
      this.editHostId.set(hostId ?? null);
      if (this.editDepartureFromHost()) this.applyHostToLocation('edit', 'departure');
      if (this.editActivityFromHost()) this.applyHostToLocation('edit', 'activity');
    });
  }

  load() {
    this.loading.set(true);
    this.svc
      .getAll({
        regionId: this.filterRegion() || undefined,
        date: this.filterDate() || undefined,
        hostId: this.filterHost() || undefined,
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

  toggleLocationFromHost(
    form: 'create' | 'edit',
    field: 'departure' | 'activity',
    checked: boolean,
  ) {
    if (field === 'departure') {
      if (form === 'create') this.createDepartureFromHost.set(checked);
      else this.editDepartureFromHost.set(checked);
      if (!checked) {
        if (form === 'create') this.createDepartureLocation.set(null);
        else this.editDepartureLocation.set(null);
      }
    } else {
      if (form === 'create') this.createActivityFromHost.set(checked);
      else this.editActivityFromHost.set(checked);
      if (!checked) {
        if (form === 'create') this.createActivityLocation.set(null);
        else this.editActivityLocation.set(null);
      }
    }
    if (checked) this.applyHostToLocation(form, field);
  }

  private applyHostToLocation(form: 'create' | 'edit', field: 'departure' | 'activity') {
    const host = form === 'create' ? this.selectedCreateHost() : this.selectedEditHost();
    if (!host?.address || host.lat === null || host.lng === null) return;
    const loc: PlaceResult = { address: host.address, lat: host.lat, lng: host.lng };
    if (field === 'departure') {
      if (form === 'create') this.createDepartureLocation.set(loc);
      else this.editDepartureLocation.set(loc);
    } else {
      if (form === 'create') this.createActivityLocation.set(loc);
      else this.editActivityLocation.set(loc);
    }
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
        hostId: this.filterHost() || undefined,
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
    this.createActivityLocation.set(null);
    this.createActivityFromHost.set(false);
    this.createDepartureLocation.set(null);
    this.createDepartureFromHost.set(false);
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
    const al = this.createActivityLocation();
    const dl = this.createDepartureLocation();

    const basePayload = {
      region_id: v.region_id!,
      name: v.name!,
      icon: this.createIconValue() || null,
      description: v.description || null,
      host_id: v.host_id || null,
      date: v.date!,
      start_time: v.start_time!,
      end_time: v.end_time!,
      activity_address: al?.address ?? null,
      activity_lat: al?.lat ?? null,
      activity_lng: al?.lng ?? null,
      departure_address: dl?.address ?? null,
      departure_lat: dl?.lat ?? null,
      departure_lng: dl?.lng ?? null,
    };

    if (this.repeatEnabled()) {
      this.svc
        .createBatch({
          ...basePayload,
          repetition: { type: this.repeatType(), count: this.repeatCount() },
        })
        .subscribe({
          next: (activities) => {
            this.saving.set(false);
            this.activeModal.set(null);
            this.load();
            if (this.viewMode() === 'calendar')
              if (this.calendarPeriod) this.fetchCalendar(this.calendarPeriod);
            if (activities[0]) this.openDetail(activities[0]);
          },
          error: () => {
            this.formError.set('Error creating activities.');
            this.saving.set(false);
          },
        });
    } else {
      this.svc.create(basePayload).subscribe({
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
    this.editIconValue.set(activity.icon ?? '');
    this.editForm.patchValue({
      name: activity.name,
      date: activity.date,
      start_time: activity.start_time,
      end_time: activity.end_time,
      description: activity.description ?? '',
      host_id: activity.host_id,
    });
    this.editDescLen.set(activity.description?.length ?? 0);
    this.editActivityLocation.set(
      activity.activity_address && activity.activity_lat !== null && activity.activity_lng !== null
        ? {
            address: activity.activity_address,
            lat: activity.activity_lat,
            lng: activity.activity_lng,
          }
        : null,
    );
    this.editDepartureLocation.set(
      activity.departure_address &&
        activity.departure_lat !== null &&
        activity.departure_lng !== null
        ? {
            address: activity.departure_address,
            lat: activity.departure_lat,
            lng: activity.departure_lng,
          }
        : null,
    );
    this.editActivityFromHost.set(false);
    this.editDepartureFromHost.set(false);
    this.editHostId.set(activity.host_id);
    this.selectedVolunteerIds.set([]);
    this.selectedGroupIds.set([]);
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
    const al = this.editActivityLocation();
    const dl = this.editDepartureLocation();
    return {
      name: v.name!,
      icon: this.editIconValue() || null,
      date: v.date!,
      start_time: v.start_time!,
      end_time: v.end_time!,
      description: v.description || null,
      host_id: v.host_id || null,
      activity_address: al?.address ?? null,
      activity_lat: al?.lat ?? null,
      activity_lng: al?.lng ?? null,
      departure_address: dl?.address ?? null,
      departure_lat: dl?.lat ?? null,
      departure_lng: dl?.lng ?? null,
    };
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
    from(ids)
      .pipe(
        concatMap((id) => this.svc.assignVolunteer(activity.id, id)),
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
