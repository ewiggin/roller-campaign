import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { Host } from '../../../core/models/host.model';
import type { Region } from '../../../core/models/region.model';
import type {
  ImportVolunteerCommitResponse,
  ImportVolunteerParseResponse,
  ImportVolunteerRow,
  VolunteerRole,
  VolunteerSummary,
} from '../../../core/models/volunteer.model';
import {
  ActivitiesService,
  type GroupScheduleActivity,
} from '../../../core/services/activities.service';
import { AuthService } from '../../../core/services/auth.service';
import { HostsService } from '../../../core/services/hosts.service';
import { RegionsService } from '../../../core/services/regions.service';
import { VolunteersService } from '../../../core/services/volunteers.service';
import { downloadFile } from '../../../core/utils/download-file';
import { SearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select';
import {
  MenuButtonComponent,
  type MenuItem,
} from '../../../shared/components/menu-button/menu-button';

type ActiveModal = 'create' | 'import' | 'truncate' | null;

interface VolScheduleState {
  days: string[];
  activities: GroupScheduleActivity[];
  loading: boolean;
  error: string;
}

const AVAILABILITY_OPTIONS = [
  { value: 'saturday_prev_morning', label: 'Sat (prev) – morning' },
  { value: 'saturday_prev_afternoon', label: 'Sat (prev) – afternoon' },
  { value: 'sunday_prev_morning', label: 'Sun (prev) – morning' },
  { value: 'sunday_prev_afternoon', label: 'Sun (prev) – afternoon' },
  { value: 'monday_morning', label: 'Mon – morning' },
  { value: 'monday_afternoon', label: 'Mon – afternoon' },
  { value: 'tuesday_morning', label: 'Tue – morning' },
  { value: 'tuesday_afternoon', label: 'Tue – afternoon' },
  { value: 'wednesday_morning', label: 'Wed – morning' },
  { value: 'wednesday_afternoon', label: 'Wed – afternoon' },
  { value: 'thursday_morning', label: 'Thu – morning' },
  { value: 'thursday_afternoon', label: 'Thu – afternoon' },
  { value: 'friday_morning', label: 'Fri – morning' },
  { value: 'friday_afternoon', label: 'Fri – afternoon' },
  { value: 'saturday_morning', label: 'Sat – morning' },
  { value: 'saturday_afternoon', label: 'Sat – afternoon' },
  { value: 'sunday_morning', label: 'Sun – morning' },
  { value: 'sunday_afternoon', label: 'Sun – afternoon' },
  { value: 'monday_next_morning', label: 'Mon (next) – morning' },
  { value: 'monday_next_afternoon', label: 'Mon (next) – afternoon' },
];

@Component({
  selector: 'app-volunteers-list',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    SearchableSelectComponent,
    MenuButtonComponent,
  ],
  templateUrl: './volunteers-list.html',
})
export class VolunteersListComponent implements OnInit {
  private readonly svc = inject(VolunteersService);
  private readonly activitiesSvc = inject(ActivitiesService);
  private readonly regionsSvc = inject(RegionsService);
  private readonly hostsSvc = inject(HostsService);
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  readonly isSuperAdmin = this.auth.isSuperAdmin;

  readonly excelMenuItems = computed<MenuItem[]>(() => [
    { label: 'Export Excel', action: () => this.downloadExcel() },
    { label: 'Template', action: () => this.downloadTemplate() },
    { label: 'Import Excel', action: () => this.openImport() },
  ]);

  readonly regions = signal<Region[]>([]);
  readonly roles = signal<VolunteerRole[]>([]);
  readonly hosts = signal<Host[]>([]);
  readonly volunteers = signal<VolunteerSummary[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly error = signal('');

  readonly filterRegion = signal('');
  readonly filterRole = signal('');
  readonly filterHost = signal('');
  readonly filterMinCarSeats = signal('');
  readonly filterAvailability = signal<string[]>([]);
  readonly filterTermsAccepted = signal<'' | 'true' | 'false'>('');
  readonly filterSearch = signal('');
  readonly termsItems = [
    { value: 'true', label: 'Accepted' },
    { value: 'false', label: 'Not accepted' },
  ];
  readonly page = signal(1);
  readonly limit = 50;

  readonly regionItems = computed(() =>
    this.regions().map((r) => ({ value: r.id, label: r.name })),
  );

  readonly roleItems = computed(() => this.roles().map((r) => ({ value: r.id, label: r.name })));

  readonly hostItems = computed(() => [
    { value: '__none__', label: 'None' },
    ...this.hosts().map((h) => ({ value: h.id, label: h.name })),
  ]);

  readonly availabilityOptions = AVAILABILITY_OPTIONS;

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.limit)));

  readonly downloadingSchedulePdf = signal<string | null>(null);

  // Planning mode
  readonly planningMode = signal(false);
  readonly expandedScheduleIds = signal<Set<string>>(new Set());
  readonly volSchedules = signal<Map<string, VolScheduleState>>(new Map());

  // Modal
  readonly activeModal = signal<ActiveModal>(null);

  // Create modal
  readonly creating = signal(false);
  readonly createError = signal('');
  readonly selectedCreateRoleIds = signal<string[]>([]);
  readonly selectedCreateRegionIds = signal<string[]>([]);

  readonly createForm = this.fb.nonNullable.group({
    volunteer_code: ['', Validators.required],
    full_name: ['', Validators.required],
    email: [''],
    phone: [''],
    is_active: [true],
  });

  // Import modal
  readonly importStep = signal<'upload' | 'preview' | 'done'>('upload');
  readonly importing = signal(false);
  readonly importError = signal('');
  readonly parseResult = signal<ImportVolunteerParseResponse | null>(null);
  readonly commitResult = signal<ImportVolunteerCommitResponse | null>(null);
  readonly importUpdateExisting = signal(false);
  readonly importDeleteAbsent = signal(false);
  readonly importSelectedColumns = signal<string[]>([]);
  readonly importIncludeNoCode = signal(true);
  readonly importCreateNew = signal(true);
  isDragging = false;

  // Truncate modal
  readonly truncating = signal(false);
  readonly truncateConfirmText = signal('');

  private readonly REQUIRED_COLUMNS = new Set(['volunteer_code']);

  private readonly COLUMN_LABELS: Record<string, string> = {
    volunteer_code: 'Code',
    full_name: 'Full name',
    email: 'Email',
    phone: 'Phone',
    region_name: 'Region',
    car_seats: 'Car seats',
    hosting_address: 'Address',
    lat: 'Lat',
    lng: 'Lng',
    maps_link: 'Maps',
    is_active: 'Active',
    role_names: 'Roles',
    monday_morning: 'Mon AM',
    monday_afternoon: 'Mon PM',
    tuesday_morning: 'Tue AM',
    tuesday_afternoon: 'Tue PM',
    wednesday_morning: 'Wed AM',
    wednesday_afternoon: 'Wed PM',
    thursday_morning: 'Thu AM',
    thursday_afternoon: 'Thu PM',
    friday_morning: 'Fri AM',
    friday_afternoon: 'Fri PM',
    saturday_morning: 'Sat AM',
    saturday_afternoon: 'Sat PM',
    sunday_morning: 'Sun AM',
    sunday_afternoon: 'Sun PM',
    saturday_prev_morning: 'Sat(p) AM',
    saturday_prev_afternoon: 'Sat(p) PM',
    sunday_prev_morning: 'Sun(p) AM',
    sunday_prev_afternoon: 'Sun(p) PM',
    monday_next_morning: 'Mon(n) AM',
    monday_next_afternoon: 'Mon(n) PM',
  };

  readonly noCodeRows = computed(() =>
    (this.parseResult()?.valid ?? []).filter((r) => r.has_code === false),
  );

  readonly validToCreate = computed(() => {
    if (!this.importCreateNew()) return [];
    const result = this.parseResult();
    if (!result) return [];
    if (this.importIncludeNoCode()) return result.valid;
    return result.valid.filter((r) => r.has_code !== false);
  });

  isRequiredColumn(col: string): boolean {
    return this.REQUIRED_COLUMNS.has(col);
  }

  columnLabel(col: string): string {
    return this.COLUMN_LABELS[col] ?? col;
  }

  toggleColumn(col: string) {
    if (this.isRequiredColumn(col)) return;
    const current = this.importSelectedColumns();
    this.importSelectedColumns.set(
      current.includes(col) ? current.filter((c) => c !== col) : [...current, col],
    );
  }

  selectAllColumns() {
    this.importSelectedColumns.set([...(this.parseResult()?.columns ?? [])]);
  }

  selectNoColumns() {
    this.importSelectedColumns.set([...this.REQUIRED_COLUMNS]);
  }

  isColumnSelected(col: string): boolean {
    return this.importSelectedColumns().includes(col);
  }

  get canCommit(): boolean {
    const result = this.parseResult();
    if (!result) return false;
    return (
      this.validToCreate().length > 0 ||
      (this.importUpdateExisting() && result.duplicateRows.length > 0) ||
      (this.importDeleteAbsent() && result.toDelete.length > 0)
    );
  }

  get commitLabel(): string {
    const result = this.parseResult();
    if (!result) return 'Import';
    const creates = this.validToCreate().length;
    const updates = this.importUpdateExisting() ? result.duplicateRows.length : 0;
    const allCols = result.columns?.length ?? 0;
    const selCols = this.importSelectedColumns().length;
    const parts: string[] = [];
    if (creates > 0) parts.push(`Import ${creates} new`);
    if (updates > 0) {
      const colNote = selCols < allCols ? ` (${selCols} cols)` : '';
      parts.push(`update ${updates} existing${colNote}`);
    }
    if (this.importDeleteAbsent() && result.toDelete.length > 0)
      parts.push(`delete ${result.toDelete.length} absent`);
    return parts.join(' + ') || 'Import';
  }

  ngOnInit() {
    this.regionsSvc.getAll().subscribe({ next: (r) => this.regions.set(r) });
    this.svc.getRoles().subscribe({ next: (r) => this.roles.set(r) });
    this.loadHosts();
    this.load();
  }

  private loadHosts() {
    const regionId = this.filterRegion() || undefined;
    this.hostsSvc.getAll(regionId).subscribe({ next: (h) => this.hosts.set(h) });
  }

  onRegionChange(regionId: string) {
    this.filterRegion.set(regionId);
    this.filterHost.set('');
    this.loadHosts();
    this.applyFilters();
  }

  private buildQuery() {
    const minSeats = this.filterMinCarSeats();
    const slots = this.filterAvailability();
    const terms = this.filterTermsAccepted();
    const host = this.filterHost();
    return {
      regionId: this.filterRegion() || undefined,
      roleId: this.filterRole() || undefined,
      hostId: host && host !== '__none__' ? host : undefined,
      noHost: host === '__none__' ? true : undefined,
      search: this.filterSearch() || undefined,
      min_car_seats: minSeats ? parseInt(minSeats, 10) : undefined,
      available_slots: slots.length ? slots : undefined,
      terms_accepted: terms === '' ? undefined : terms === 'true',
    };
  }

  load() {
    this.loading.set(true);
    this.svc.getAll({ ...this.buildQuery(), page: this.page(), limit: this.limit }).subscribe({
      next: (res) => {
        this.volunteers.set(res.data);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Error loading volunteers.');
        this.loading.set(false);
      },
    });
  }

  applyFilters() {
    this.page.set(1);
    this.load();
  }

  clearFilters() {
    this.filterRegion.set('');
    this.filterRole.set('');
    this.filterHost.set('');
    this.filterMinCarSeats.set('');
    this.filterAvailability.set([]);
    this.filterTermsAccepted.set('');
    this.filterSearch.set('');
    this.loadHosts();
    this.applyFilters();
  }

  readonly hasActiveFilters = computed(
    () =>
      !!this.filterRegion() ||
      !!this.filterRole() ||
      !!this.filterHost() ||
      !!this.filterMinCarSeats() ||
      this.filterAvailability().length > 0 ||
      this.filterTermsAccepted() !== '' ||
      !!this.filterSearch(),
  );

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

  // ── Modal helpers ──────────────────────────────────────────────────────────

  closeModal() {
    if (this.activeModal() === 'import' && this.importStep() === 'done') {
      this.load();
    }
    this.activeModal.set(null);
  }

  // ── Create modal ───────────────────────────────────────────────────────────

  openCreate() {
    this.createForm.reset({
      volunteer_code: '',
      full_name: '',
      email: '',
      phone: '',
      is_active: true,
    });
    this.selectedCreateRoleIds.set([]);
    this.selectedCreateRegionIds.set([]);
    this.createError.set('');
    this.activeModal.set('create');
  }

  isCreateRoleSelected(roleId: string): boolean {
    return this.selectedCreateRoleIds().includes(roleId);
  }

  toggleCreateRole(roleId: string) {
    const current = this.selectedCreateRoleIds();
    this.selectedCreateRoleIds.set(
      current.includes(roleId) ? current.filter((id) => id !== roleId) : [...current, roleId],
    );
  }

  isCreateRegionSelected(regionId: string): boolean {
    return this.selectedCreateRegionIds().includes(regionId);
  }

  toggleCreateRegion(regionId: string) {
    const current = this.selectedCreateRegionIds();
    this.selectedCreateRegionIds.set(
      current.includes(regionId) ? current.filter((id) => id !== regionId) : [...current, regionId],
    );
  }

  createVolunteer() {
    if (this.createForm.invalid || this.creating()) return;
    this.creating.set(true);
    this.createError.set('');

    const raw = this.createForm.getRawValue();
    this.svc
      .create({
        volunteer_code: raw.volunteer_code.trim(),
        full_name: raw.full_name.trim(),
        email: raw.email.trim() || null,
        phone: raw.phone.trim() || null,
        is_active: raw.is_active,
        role_ids: this.selectedCreateRoleIds(),
        region_ids: this.selectedCreateRegionIds(),
      })
      .subscribe({
        next: () => {
          this.creating.set(false);
          this.activeModal.set(null);
          this.applyFilters();
        },
        error: (err) => {
          this.creating.set(false);
          this.createError.set(
            err.status === 409 ? 'Volunteer code already exists.' : 'Error creating volunteer.',
          );
        },
      });
  }

  downloadSchedulePdf(vol: VolunteerSummary) {
    if (this.downloadingSchedulePdf()) return;
    this.downloadingSchedulePdf.set(vol.id);
    this.activitiesSvc.exportVolunteerSchedulePdf(vol.id).subscribe({
      next: async (blob) => {
        await downloadFile(blob, `calendario-${vol.volunteer_code.toLowerCase()}.pdf`);
        this.downloadingSchedulePdf.set(null);
      },
      error: () => this.downloadingSchedulePdf.set(null),
    });
  }

  // ── Import modal ───────────────────────────────────────────────────────────

  downloadExcel() {
    this.svc.exportExcel(this.buildQuery()).subscribe((blob) => {
      void downloadFile(blob, 'voluntarios.xlsx');
    });
  }

  downloadTemplate() {
    this.svc.downloadTemplate().subscribe((blob) => {
      void downloadFile(blob, 'plantilla-voluntarios.xlsx');
    });
  }

  openImport() {
    this.importStep.set('upload');
    this.importError.set('');
    this.parseResult.set(null);
    this.commitResult.set(null);
    this.importUpdateExisting.set(false);
    this.importDeleteAbsent.set(false);
    this.importSelectedColumns.set([]);
    this.importIncludeNoCode.set(true);
    this.importCreateNew.set(true);
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
    if (file) this.parseFile(file);
  }

  onFileSelected(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (file) this.parseFile(file);
  }

  private parseFile(file: File) {
    this.importing.set(true);
    this.importError.set('');
    this.svc.parseImport(file).subscribe({
      next: (result) => {
        this.parseResult.set(result);
        this.importSelectedColumns.set([...(result.columns ?? [])]);
        this.importStep.set('preview');
        this.importing.set(false);
      },
      error: () => {
        this.importError.set('Error parsing file. Check the format.');
        this.importing.set(false);
      },
    });
  }

  commitImport() {
    const result = this.parseResult();
    if (!result || !this.canCommit) return;
    this.importing.set(true);
    this.importError.set('');
    const rows = this.validToCreate() as ImportVolunteerRow[];
    const updateRows = this.importUpdateExisting() ? result.duplicateRows : undefined;
    const deleteAbsent = this.importDeleteAbsent() ? true : undefined;
    const toDeleteCodes = deleteAbsent ? result.toDelete : undefined;
    const selectedCols = this.importSelectedColumns();
    const allCols = result.columns ?? [];
    const isPartial = selectedCols.length < allCols.length;
    this.svc
      .commitImport(
        rows,
        updateRows as ImportVolunteerRow[] | undefined,
        deleteAbsent,
        isPartial ? true : undefined,
        isPartial ? selectedCols : undefined,
        toDeleteCodes,
      )
      .subscribe({
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

  // ── Truncate modal ─────────────────────────────────────────────────────────

  openTruncate() {
    this.truncateConfirmText.set('');
    this.activeModal.set('truncate');
  }

  confirmTruncate() {
    if (this.truncateConfirmText() !== 'DELETE' || this.truncating()) return;
    this.truncating.set(true);
    this.svc.truncate().subscribe({
      next: () => {
        this.truncating.set(false);
        this.activeModal.set(null);
        this.load();
      },
      error: () => this.truncating.set(false),
    });
  }

  // ── Planning mode ─────────────────────────────────────────────────────────

  togglePlanningMode() {
    if (this.planningMode()) {
      this.planningMode.set(false);
      this.expandedScheduleIds.set(new Set());
    } else {
      this.planningMode.set(true);
    }
  }

  expandAllSchedules() {
    const vols = this.volunteers();
    this.expandedScheduleIds.set(new Set(vols.map((v) => v.id)));
    for (const v of vols) this.loadScheduleIfNeeded(v.id);
  }

  collapseAllSchedules() {
    this.expandedScheduleIds.set(new Set());
  }

  toggleGroupSchedule(volunteerId: string) {
    const next = new Set(this.expandedScheduleIds());
    if (next.has(volunteerId)) {
      next.delete(volunteerId);
    } else {
      next.add(volunteerId);
      this.loadScheduleIfNeeded(volunteerId);
    }
    this.expandedScheduleIds.set(next);
  }

  isScheduleExpanded(volunteerId: string): boolean {
    return this.expandedScheduleIds().has(volunteerId);
  }

  getScheduleForVol(volunteerId: string): VolScheduleState | undefined {
    return this.volSchedules().get(volunteerId);
  }

  private loadScheduleIfNeeded(volunteerId: string) {
    const existing = this.volSchedules().get(volunteerId);
    if (existing && !existing.error) return;

    const m = new Map(this.volSchedules());
    m.set(volunteerId, { days: [], activities: [], loading: true, error: '' });
    this.volSchedules.set(m);

    this.activitiesSvc.getVolunteerSchedule(volunteerId).subscribe({
      next: (data) => {
        const m2 = new Map(this.volSchedules());
        m2.set(volunteerId, { ...data, loading: false, error: '' });
        this.volSchedules.set(m2);
      },
      error: () => {
        const m2 = new Map(this.volSchedules());
        m2.set(volunteerId, {
          days: [],
          activities: [],
          loading: false,
          error: 'Error al cargar el planning.',
        });
        this.volSchedules.set(m2);
      },
    });
  }

  scheduleTimeslots(activities: GroupScheduleActivity[]): string[] {
    const times = new Set(activities.map((a) => a.start_time));
    return [...times].sort();
  }

  getActivitiesForCell(
    activities: GroupScheduleActivity[],
    day: string,
    time: string,
  ): GroupScheduleActivity[] {
    return activities.filter((a) => a.date === day && a.start_time === time);
  }

  shortDayLabel(iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    const names = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return `${names[d.getDay()]} ${d.getDate()}`;
  }
}
