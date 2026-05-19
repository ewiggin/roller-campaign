import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { SearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select';
import type { Activity, ActivityStatus, AvailableGroupForActivity } from '../../../core/models/activity.model';
import type { Region } from '../../../core/models/region.model';
import type { VolunteerSummary } from '../../../core/models/volunteer.model';
import { ActivitiesService } from '../../../core/services/activities.service';
import { RegionsService } from '../../../core/services/regions.service';
import { VolunteersService } from '../../../core/services/volunteers.service';

type ActiveModal = 'create' | 'detail' | null;
type DetailTab = 'info' | 'volunteers' | 'groups';

@Component({
  selector: 'app-activities-list',
  imports: [ReactiveFormsModule, FormsModule, DatePipe, SearchableSelectComponent],
  templateUrl: './activities-list.html',
})
export class ActivitiesListComponent implements OnInit {
  private readonly svc = inject(ActivitiesService);
  private readonly volunteersSvc = inject(VolunteersService);
  private readonly regionsSvc = inject(RegionsService);
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

  // Create modal
  readonly activeModal = signal<ActiveModal>(null);
  readonly saving = signal(false);
  readonly formError = signal('');
  readonly createForm = this.fb.group({
    region_id: ['', Validators.required],
    date: ['', Validators.required],
    start_time: ['', [Validators.required, Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d$/)]],
    end_time: ['', [Validators.required, Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d$/)]],
    description: [''],
    lat: [null as number | null],
    lng: [null as number | null],
  });

  // Detail modal
  readonly selectedActivity = signal<Activity | null>(null);
  readonly detailTab = signal<DetailTab>('info');
  readonly detailSaving = signal(false);
  readonly detailError = signal('');
  readonly editForm = this.fb.group({
    date: ['', Validators.required],
    start_time: ['', [Validators.required, Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d$/)]],
    end_time: ['', [Validators.required, Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d$/)]],
    description: [''],
    lat: [null as number | null],
    lng: [null as number | null],
  });

  // Volunteers tab
  readonly regionVolunteers = signal<VolunteerSummary[]>([]);
  readonly volunteersLoading = signal(false);
  readonly selectedVolunteerId = signal('');
  readonly availableVolunteers = computed(() => {
    const assigned = new Set(this.selectedActivity()?.volunteers.map((v) => v.id) ?? []);
    return this.regionVolunteers().filter((v) => !assigned.has(v.id) && v.is_active);
  });

  // Groups tab
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

  // ── Create ────────────────────────────────────────────────────────────────

  openCreate() {
    this.createForm.reset({ region_id: this.filterRegion() || this.regions()[0]?.id });
    this.formError.set('');
    this.activeModal.set('create');
  }

  submitCreate() {
    this.createForm.markAllAsTouched();
    if (this.createForm.invalid) return;
    this.saving.set(true);
    this.formError.set('');
    const v = this.createForm.getRawValue();
    this.svc
      .create({
        region_id: v.region_id!,
        date: v.date!,
        start_time: v.start_time!,
        end_time: v.end_time!,
        description: v.description || null,
        lat: v.lat ?? null,
        lng: v.lng ?? null,
      })
      .subscribe({
        next: (activity) => {
          this.saving.set(false);
          this.activeModal.set(null);
          this.load();
          this.openDetail(activity);
        },
        error: () => {
          this.formError.set('Error creating activity.');
          this.saving.set(false);
        },
      });
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
    this.editForm.patchValue({
      date: activity.date,
      start_time: activity.start_time,
      end_time: activity.end_time,
      description: activity.description ?? '',
      lat: activity.lat,
      lng: activity.lng,
    });
    this.selectedVolunteerId.set('');
    this.selectedGroupId.set('');
    this.activeModal.set('detail');
    this.loadRegionData(activity);
  }

  private loadRegionData(activity: Activity) {
    this.volunteersLoading.set(true);
    this.groupsLoading.set(true);
    this.volunteersSvc.getAll({ regionId: activity.region_id }).subscribe({
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
    this.svc
      .update(activity.id, {
        date: v.date!,
        start_time: v.start_time!,
        end_time: v.end_time!,
        description: v.description || null,
        lat: v.lat ?? null,
        lng: v.lng ?? null,
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
    if (
      !confirm(`Delete activity on ${activity.date} (${activity.start_time}–${activity.end_time})?`)
    )
      return;
    this.svc.remove(activity.id).subscribe({
      next: () => {
        if (this.selectedActivity()?.id === activity.id) this.activeModal.set(null);
        this.load();
      },
      error: () => alert('Error deleting activity.'),
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

  isInvalid(form: 'create' | 'edit', field: string): boolean {
    const c = form === 'create' ? this.createForm.get(field) : this.editForm.get(field);
    return !!(c?.invalid && c?.touched);
  }
}
