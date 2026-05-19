import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import type { Activity, ActivityStatus, AvailableGroupForActivity, RepeatType } from '../../../core/models/activity.model';
import type { Host } from '../../../core/models/host.model';
import type { Region } from '../../../core/models/region.model';
import type { VolunteerSummary } from '../../../core/models/volunteer.model';
import { ActivitiesService } from '../../../core/services/activities.service';
import { HostsService } from '../../../core/services/hosts.service';
import { RegionsService } from '../../../core/services/regions.service';
import { VolunteersService } from '../../../core/services/volunteers.service';
import { EmojiPickerComponent } from '../../../shared/components/emoji-picker/emoji-picker';
import { LocationPickerComponent, type PlaceResult } from '../../../shared/components/location-picker/location-picker';
import { SearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select';

type ActiveModal = 'create' | 'detail' | null;
type DetailTab = 'info' | 'volunteers' | 'groups';

@Component({
  selector: 'app-activities-list',
  imports: [ReactiveFormsModule, FormsModule, DatePipe, SearchableSelectComponent, LocationPickerComponent, EmojiPickerComponent],
  templateUrl: './activities-list.html',
})
export class ActivitiesListComponent implements OnInit {
  private readonly svc = inject(ActivitiesService);
  private readonly volunteersSvc = inject(VolunteersService);
  private readonly regionsSvc = inject(RegionsService);
  private readonly hostsSvc = inject(HostsService);
  private readonly fb = inject(FormBuilder);

  readonly regions = signal<Region[]>([]);
  readonly activities = signal<Activity[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly total = signal(0);
  readonly page = signal(1);
  readonly limit = 50;

  readonly filterRegion = signal('');
  readonly filterStatus = signal<ActivityStatus | ''>('');
  readonly filterDate = signal('');

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.limit)));

  readonly regionItems = computed(() =>
    this.regions().map((r) => ({ value: r.id, label: r.name })),
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

  readonly regionVolunteers = signal<VolunteerSummary[]>([]);
  readonly volunteersLoading = signal(false);
  readonly selectedVolunteerId = signal('');
  readonly availableVolunteers = computed(() => {
    const assigned = new Set(this.selectedActivity()?.volunteers.map((v) => v.id) ?? []);
    return this.regionVolunteers().filter((v) => !assigned.has(v.id) && v.is_active);
  });

  // ── Groups tab ────────────────────────────────────────────────────────────

  readonly availableGroups = signal<AvailableGroupForActivity[]>([]);
  readonly groupsLoading = signal(false);
  readonly selectedGroupId = signal('');

  readonly availableVolunteerItems = computed(() =>
    this.availableVolunteers().map((v) => ({
      value: v.id,
      label: v.full_name,
      meta: v.volunteer_code,
    })),
  );

  readonly availableGroupItems = computed(() =>
    this.availableGroups().map((g) => ({
      value: g.id,
      label: g.group_code,
      meta: [
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
        if (r.length > 0) this.filterRegion.set(r[0].id);
        this.load();
      },
    });

    this.createForm.get('date')!.valueChanges.subscribe((d) => this.createDate.set(d ?? ''));

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
    this.load();
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

  toggleLocationFromHost(form: 'create' | 'edit', field: 'departure' | 'activity', checked: boolean) {
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

  private loadHostsForRegion(regionId: string) {
    this.hostsLoading.set(true);
    this.hostsSvc.getAll(regionId).subscribe({
      next: (hosts) => { this.modalHosts.set(hosts); this.hostsLoading.set(false); },
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
      this.svc.createBatch({ ...basePayload, repetition: { type: this.repeatType(), count: this.repeatCount() } })
        .subscribe({
          next: (activities) => {
            this.saving.set(false);
            this.activeModal.set(null);
            this.load();
            if (activities[0]) this.openDetail(activities[0]);
          },
          error: () => { this.formError.set('Error creating activities.'); this.saving.set(false); },
        });
    } else {
      this.svc.create(basePayload).subscribe({
        next: (activity) => {
          this.saving.set(false);
          this.activeModal.set(null);
          this.load();
          this.openDetail(activity);
        },
        error: () => { this.formError.set('Error creating activity.'); this.saving.set(false); },
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
        ? { address: activity.activity_address, lat: activity.activity_lat, lng: activity.activity_lng }
        : null,
    );
    this.editDepartureLocation.set(
      activity.departure_address && activity.departure_lat !== null && activity.departure_lng !== null
        ? { address: activity.departure_address, lat: activity.departure_lat, lng: activity.departure_lng }
        : null,
    );
    this.editActivityFromHost.set(false);
    this.editDepartureFromHost.set(false);
    this.editHostId.set(activity.host_id);
    this.selectedVolunteerId.set('');
    this.selectedGroupId.set('');
    this.activeModal.set('detail');
    this.loadHostsForRegion(activity.region_id);
    this.loadRegionData(activity);
  }

  private loadRegionData(activity: Activity) {
    this.volunteersLoading.set(true);
    this.groupsLoading.set(true);
    this.volunteersSvc.getAll({ regionId: activity.region_id, date: activity.date }).subscribe({
      next: (res) => { this.regionVolunteers.set(res.data); this.volunteersLoading.set(false); },
      error: () => this.volunteersLoading.set(false),
    });
    this.svc.getAvailableGroups(activity.id).subscribe({
      next: (groups) => { this.availableGroups.set(groups); this.groupsLoading.set(false); },
      error: () => this.groupsLoading.set(false),
    });
  }

  reloadAvailableGroups() {
    const activity = this.selectedActivity();
    if (!activity) return;
    this.groupsLoading.set(true);
    this.svc.getAvailableGroups(activity.id).subscribe({
      next: (groups) => { this.availableGroups.set(groups); this.groupsLoading.set(false); },
      error: () => this.groupsLoading.set(false),
    });
  }

  saveInfo() {
    this.editForm.markAllAsTouched();
    if (this.editForm.invalid) return;
    const activity = this.selectedActivity();
    if (!activity) return;
    this.detailSaving.set(true);
    this.detailError.set('');
    const v = this.editForm.getRawValue();
    const al = this.editActivityLocation();
    const dl = this.editDepartureLocation();
    this.svc
      .update(activity.id, {
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
      })
      .subscribe({
        next: (updated) => {
          this.selectedActivity.set(updated);
          this.detailSaving.set(false);
          this.activeModal.set(null);
          this.load();
        },
        error: () => {
          this.detailError.set('Error saving changes.');
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

  addVolunteer() {
    const vid = this.selectedVolunteerId();
    const activity = this.selectedActivity();
    if (!vid || !activity) return;
    this.detailSaving.set(true);
    this.svc.assignVolunteer(activity.id, vid).subscribe({
      next: (updated) => {
        this.selectedActivity.set(updated);
        this.selectedVolunteerId.set('');
        this.detailSaving.set(false);
        this.load();
      },
      error: () => {
        this.detailError.set('Error assigning volunteer.');
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

  addGroup() {
    const gid = this.selectedGroupId();
    const activity = this.selectedActivity();
    if (!gid || !activity) return;
    this.detailSaving.set(true);
    this.svc.assignGuestGroup(activity.id, gid).subscribe({
      next: (updated) => {
        this.selectedActivity.set(updated);
        this.selectedGroupId.set('');
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
      },
      error: () => alert('Error deleting activity.'),
    });
  }

  deleteSeriesFromHere(activity: Activity) {
    if (!confirm(`Delete "${activity.name || activity.date}" and all future activities in this series?`)) return;
    this.svc.removeSeriesFromDate(activity.id).subscribe({
      next: () => { this.activeModal.set(null); this.load(); },
      error: () => alert('Error deleting series.'),
    });
  }

  closeModal() {
    this.activeModal.set(null);
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
      weekday: 'short', day: 'numeric', month: 'short',
    });
  }

  isInvalid(form: 'create' | 'edit', field: string): boolean {
    const c = form === 'create' ? this.createForm.get(field) : this.editForm.get(field);
    return !!(c?.invalid && c?.touched);
  }
}
