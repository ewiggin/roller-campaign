import { DatePipe, DecimalPipe } from '@angular/common';
import {
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type {
  GroupComposition,
  GuestGroup,
  ImportGroupCommitResponse,
  ImportGroupParseResponse,
  ImportGroupRow,
} from '../../../core/models/guest-group.model';
import type { Guest } from '../../../core/models/guest.model';
import type { Host } from '../../../core/models/host.model';
import type { Region } from '../../../core/models/region.model';
import {
  ActivitiesService,
  type GroupScheduleActivity,
} from '../../../core/services/activities.service';
import { AuthService } from '../../../core/services/auth.service';
import { GuestGroupsService } from '../../../core/services/guest-groups.service';
import { GuestsService } from '../../../core/services/guests.service';
import { HostsService } from '../../../core/services/hosts.service';
import { RegionsService } from '../../../core/services/regions.service';
import { downloadFile } from '../../../core/utils/download-file';
import {
  MenuButtonComponent,
  type MenuItem,
} from '../../../shared/components/menu-button/menu-button';
import { SearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select';

type ActiveModal =
  | 'create'
  | 'guests'
  | 'import'
  | 'assign-host'
  | 'edit'
  | 'truncate'
  | 'delete-filtered'
  | null;

export const COMPOSITION_LABELS: Record<GroupComposition, string> = {
  men_only: 'Men only',
  mixed: 'Mixed',
  women_only: 'Women only',
};

interface GroupScheduleState {
  days: string[];
  activities: GroupScheduleActivity[];
  loading: boolean;
  error: string;
}

@Component({
  selector: 'app-guest-groups-list',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    DatePipe,
    DecimalPipe,
    SearchableSelectComponent,
    MenuButtonComponent,
  ],
  templateUrl: './guest-groups-list.html',
})
export class GuestGroupsListComponent implements OnInit {
  private readonly svc = inject(GuestGroupsService);
  private readonly activitiesSvc = inject(ActivitiesService);
  private readonly guestsSvc = inject(GuestsService);
  private readonly regionsSvc = inject(RegionsService);
  private readonly hostsSvc = inject(HostsService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);

  readonly isSuperAdmin = this.auth.isSuperAdmin;
  readonly compositionOptions = Object.entries(COMPOSITION_LABELS) as [GroupComposition, string][];

  readonly excelMenuItems = computed<MenuItem[]>(() => [
    { label: 'Export Excel', action: () => this.downloadExcel() },
    { label: 'Template', action: () => this.downloadTemplate() },
    { label: 'Import Excel', action: () => this.openImport() },
  ]);

  readonly deleteMenuItems = computed<MenuItem[]>(() => [
    { label: 'Delete all', action: () => this.openTruncate() },
    { label: 'Delete current filter', action: () => this.openDeleteFiltered() },
  ]);

  readonly regions = signal<Region[]>([]);
  readonly groups = signal<GuestGroup[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly selectedRegionId = signal('');
  readonly total = signal(0);
  readonly page = signal(1);
  readonly limit = 50;
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.limit)));

  readonly regionItems = computed(() =>
    this.regions().map((r) => ({ value: r.id, label: r.name })),
  );

  readonly activeModal = signal<ActiveModal>(null);
  readonly saving = signal(false);
  readonly formError = signal('');
  readonly truncating = signal(false);
  readonly truncateConfirmText = signal('');

  readonly activeFilterSummary = computed(() => {
    const parts: string[] = [];
    const region = this.regionName();
    if (region) parts.push(`Region: ${region}`);
    const search = this.searchCode().trim();
    if (search) parts.push(`Search: "${search}"`);
    const hostVal = this.filterHost();
    if (hostVal === '__none__') {
      parts.push('Congregation: None');
    } else if (hostVal) {
      const name = this.filterHosts().find((h) => h.id === hostVal)?.name;
      if (name) parts.push(`Congregation: ${name}`);
    }
    return parts.join(' · ');
  });
  readonly recomputing = signal(false);
  readonly downloadingSchedulePdf = signal<string | null>(null);

  // Congregation filter
  readonly filterHost = signal('');
  readonly filterHosts = signal<Host[]>([]);
  readonly filterHostItems = computed(() => [
    { value: '__none__', label: 'None' },
    ...this.filterHosts().map((h) => ({ value: h.id, label: h.name })),
  ]);

  // Planning mode
  readonly planningMode = signal(false);
  readonly expandedScheduleIds = signal<Set<string>>(new Set());
  readonly groupSchedules = signal<Map<string, GroupScheduleState>>(new Map());

  // Host assignment modal
  readonly hostAssignGroup = signal<GuestGroup | null>(null);
  readonly hosts = signal<Host[]>([]);
  readonly hostsLoading = signal(false);
  readonly selectedHostId = signal<string>('');

  readonly hostItems = computed(() =>
    this.hosts().map((h) => ({
      value: h.id,
      label: h.name,
      meta: [h.address, h.guest_count ? `${h.guest_count} guests` : null]
        .filter(Boolean)
        .join(' · '),
    })),
  );
  readonly assigningHost = signal(false);

  // Import modal
  readonly importStep = signal<'upload' | 'preview' | 'done'>('upload');
  readonly importRegionId = signal('');
  readonly importing = signal(false);
  readonly importError = signal('');
  readonly parseResult = signal<ImportGroupParseResponse | null>(null);
  readonly commitResult = signal<ImportGroupCommitResponse | null>(null);
  readonly importUpdateExisting = signal(false);
  readonly importDeleteAbsent = signal(false);
  readonly importSelectedColumns = signal<string[]>([]);
  isDragging = false;

  private readonly REQUIRED_COLUMNS = new Set(['group_code']);

  private readonly COLUMN_LABELS: Record<string, string> = {
    group_code: 'Group code',
    region_name: 'Region',
    host_name: 'Congregation',
    available_from: 'Available from',
    available_to: 'Available to',
    composition: 'Composition',
    car_count: 'Car count',
  };

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
      result.valid.length > 0 ||
      (this.importUpdateExisting() && (result.duplicateRows?.length ?? 0) > 0) ||
      (this.importDeleteAbsent() && (result.toDelete?.length ?? 0) > 0)
    );
  }

  get commitLabel(): string {
    const result = this.parseResult();
    if (!result) return 'Import';
    const creates = result.valid.length;
    const updates = this.importUpdateExisting() ? (result.duplicateRows?.length ?? 0) : 0;
    const allCols = result.columns?.length ?? 0;
    const selCols = this.importSelectedColumns().length;
    const parts: string[] = [];
    if (creates > 0) parts.push(`Create ${creates}`);
    if (updates > 0) parts.push(`Update ${updates} (${selCols}/${allCols} cols)`);
    if (this.importDeleteAbsent() && (result.toDelete?.length ?? 0) > 0)
      parts.push(`Delete ${result.toDelete.length}`);
    return parts.join(' · ') || 'Import';
  }

  // Guests modal
  readonly detailGroup = signal<GuestGroup | null>(null);
  readonly groupGuests = signal<Guest[]>([]);
  readonly guestsLoading = signal(false);
  readonly guestsError = signal('');

  // Edit availability/composition modal
  readonly editGroup = signal<GuestGroup | null>(null);
  readonly editForm = this.fb.nonNullable.group({
    region_id: ['' as string, Validators.required],
    available_from: ['' as string],
    available_to: ['' as string],
    composition: ['' as string],
    car_count: [null as number | null],
  });

  readonly groupContact = computed(
    () => this.groupGuests().find((g) => g.is_group_contact) ?? null,
  );
  readonly otherGuests = computed(() => this.groupGuests().filter((g) => !g.is_group_contact));

  readonly form = this.fb.nonNullable.group({
    group_code: ['', Validators.required],
    region_id: ['', Validators.required],
  });

  readonly searchCode = signal('');
  readonly minCarSeats = signal(0);
  readonly selectedLanguages = signal<string[]>([]);
  readonly selectedCompositions = signal<string[]>([]);
  readonly hasCars = signal<boolean | undefined>(undefined);
  readonly availableLanguages = signal<string[]>([]);
  readonly langDropdownOpen = signal(false);
  readonly compDropdownOpen = signal(false);
  readonly hasActiveFilters = computed(
    () =>
      !!this.filterHost() ||
      this.minCarSeats() > 0 ||
      this.selectedLanguages().length > 0 ||
      this.selectedCompositions().length > 0 ||
      this.hasCars() !== undefined,
  );

  @ViewChild('langDropdown') private readonly langDropdownRef?: ElementRef<HTMLElement>;
  @ViewChild('compDropdown') private readonly compDropdownRef?: ElementRef<HTMLElement>;

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent) {
    if (this.langDropdownRef && !this.langDropdownRef.nativeElement.contains(e.target as Node)) {
      this.langDropdownOpen.set(false);
    }
    if (this.compDropdownRef && !this.compDropdownRef.nativeElement.contains(e.target as Node)) {
      this.compDropdownOpen.set(false);
    }
  }

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  readonly regionName = computed(() => {
    const rid = this.selectedRegionId();
    return this.regions().find((r) => r.id === rid)?.name ?? '';
  });

  ngOnInit() {
    const qp = this.route.snapshot.queryParamMap;
    const search = qp.get('search');
    const regionId = qp.get('regionId');
    if (search) this.searchCode.set(search);
    if (regionId) this.selectedRegionId.set(regionId);

    this.regionsSvc.getAll().subscribe({
      next: (r) => {
        this.regions.set(r);
        this.loadFilterHosts();
        this.loadGroups();
      },
      error: () => {
        this.error.set('Error loading regions.');
        this.loading.set(false);
      },
    });
  }

  private loadFilterHosts() {
    const regionId = this.selectedRegionId() || undefined;
    this.hostsSvc.getAll(regionId).subscribe({ next: (h) => this.filterHosts.set(h) });
  }

  onSearchInput(value: string) {
    this.searchCode.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page.set(1);
      this.loadGroups();
    }, 300);
  }

  loadGroups() {
    this.loading.set(true);
    const search = this.searchCode().trim() || undefined;
    const host = this.filterHost();
    this.svc
      .getAll({
        regionId: this.selectedRegionId() || undefined,
        page: this.page(),
        limit: this.limit,
        search,
        minCarSeats: this.minCarSeats() > 0 ? this.minCarSeats() : undefined,
        languages: this.selectedLanguages().length > 0 ? this.selectedLanguages() : undefined,
        compositions:
          this.selectedCompositions().length > 0 ? this.selectedCompositions() : undefined,
        hasCars: this.hasCars(),
        hostId: host && host !== '__none__' ? host : undefined,
        noHost: host === '__none__' ? true : undefined,
      })
      .subscribe({
        next: (res) => {
          this.groups.set(res.data);
          this.total.set(res.total);
          this.availableLanguages.set(res.available_languages ?? []);
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
    this.filterHost.set('');
    this.page.set(1);
    this.searchCode.set('');
    this.selectedLanguages.set([]);
    this.selectedCompositions.set([]);
    this.minCarSeats.set(0);
    this.loadFilterHosts();
    this.loadGroups();
  }

  toggleLanguage(lang: string) {
    this.selectedLanguages.update((langs) =>
      langs.includes(lang) ? langs.filter((l) => l !== lang) : [...langs, lang],
    );
    this.page.set(1);
    this.loadGroups();
  }

  toggleComposition(comp: string) {
    this.selectedCompositions.update((comps) =>
      comps.includes(comp) ? comps.filter((c) => c !== comp) : [...comps, comp],
    );
    this.page.set(1);
    this.loadGroups();
  }

  onMinCarSeatsInput(value: string) {
    const n = parseInt(value, 10);
    this.minCarSeats.set(isNaN(n) || n < 0 ? 0 : n);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page.set(1);
      this.loadGroups();
    }, 300);
  }

  onHasCarsChange(value: string) {
    this.hasCars.set(value === 'true' ? true : value === 'false' ? false : undefined);
    this.page.set(1);
    this.loadGroups();
  }

  clearFilters() {
    this.filterHost.set('');
    this.minCarSeats.set(0);
    this.selectedLanguages.set([]);
    this.selectedCompositions.set([]);
    this.hasCars.set(undefined);
    this.page.set(1);
    this.loadGroups();
  }

  prevPage() {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
      this.loadGroups();
    }
  }

  nextPage() {
    if (this.page() < this.totalPages()) {
      this.page.update((p) => p + 1);
      this.loadGroups();
    }
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

  openEdit(group: GuestGroup) {
    this.editGroup.set(group);
    this.formError.set('');
    this.editForm.setValue({
      region_id: group.region_id,
      available_from: group.available_from ?? '',
      available_to: group.available_to ?? '',
      composition: group.composition ?? '',
      car_count: group.car_count ?? null,
    });
    this.activeModal.set('edit');
  }

  saveEdit() {
    const group = this.editGroup();
    if (!group || this.saving()) return;
    this.saving.set(true);
    this.formError.set('');
    const v = this.editForm.getRawValue();
    this.svc
      .update(group.id, {
        region_id: v.region_id,
        available_from: v.available_from || null,
        available_to: v.available_to || null,
        composition: (v.composition as GroupComposition) || null,
        car_count: v.car_count ?? null,
      })
      .subscribe({
        next: (updated) => {
          this.groups.update((list) => list.map((g) => (g.id === updated.id ? updated : g)));
          this.activeModal.set(null);
          this.saving.set(false);
        },
        error: () => {
          this.formError.set('Error saving changes.');
          this.saving.set(false);
        },
      });
  }

  openImport() {
    this.importStep.set('upload');
    this.importRegionId.set(this.selectedRegionId() || '');
    this.importError.set('');
    this.parseResult.set(null);
    this.commitResult.set(null);
    this.importUpdateExisting.set(false);
    this.importDeleteAbsent.set(false);
    this.importSelectedColumns.set([]);
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
    const regionId = this.importRegionId() || undefined;
    const updateRows = this.importUpdateExisting() ? (result.duplicateRows ?? []) : undefined;
    const deleteAbsent = this.importDeleteAbsent() ? true : undefined;
    const toDeleteCodes = deleteAbsent ? result.toDelete : undefined;
    const selectedCols = this.importSelectedColumns();
    const allCols = result.columns ?? [];
    const isPartial = selectedCols.length < allCols.length;
    this.svc
      .commitImport(
        result.valid as ImportGroupRow[],
        updateRows,
        regionId,
        deleteAbsent,
        isPartial ? true : undefined,
        isPartial ? selectedCols : undefined,
        toDeleteCodes,
        result.columns,
      )
      .subscribe({
        next: (res) => {
          this.commitResult.set(res);
          this.importStep.set('done');
          this.importing.set(false);
          this.loadGroups();
        },
        error: () => {
          this.importError.set('Error committing import.');
          this.importing.set(false);
        },
      });
  }

  downloadExcel() {
    this.svc.exportExcel(this.selectedRegionId() || undefined).subscribe((blob) => {
      void downloadFile(blob, 'grupos.xlsx');
    });
  }

  downloadTemplate() {
    this.svc.downloadTemplate().subscribe((blob) => {
      void downloadFile(blob, 'plantilla-grupos.xlsx');
    });
  }

  downloadSchedulePdf(group: GuestGroup) {
    if (this.downloadingSchedulePdf()) return;
    this.downloadingSchedulePdf.set(group.id);
    this.activitiesSvc.exportGroupSchedulePdf(group.id).subscribe({
      next: async (blob) => {
        await downloadFile(blob, `calendario-${group.group_code.toLowerCase()}.pdf`);
        this.downloadingSchedulePdf.set(null);
      },
      error: () => this.downloadingSchedulePdf.set(null),
    });
  }

  togglePlanningMode() {
    if (this.planningMode()) {
      this.planningMode.set(false);
      this.expandedScheduleIds.set(new Set());
    } else {
      this.planningMode.set(true);
    }
  }

  expandAllSchedules() {
    const groups = this.groups();
    this.expandedScheduleIds.set(new Set(groups.map((g) => g.id)));
    for (const g of groups) this.loadScheduleIfNeeded(g.id);
  }

  collapseAllSchedules() {
    this.expandedScheduleIds.set(new Set());
  }

  toggleGroupSchedule(groupId: string) {
    const next = new Set(this.expandedScheduleIds());
    if (next.has(groupId)) {
      next.delete(groupId);
    } else {
      next.add(groupId);
      this.loadScheduleIfNeeded(groupId);
    }
    this.expandedScheduleIds.set(next);
  }

  isScheduleExpanded(groupId: string): boolean {
    return this.expandedScheduleIds().has(groupId);
  }

  getScheduleForGroup(groupId: string): GroupScheduleState | undefined {
    return this.groupSchedules().get(groupId);
  }

  private loadScheduleIfNeeded(groupId: string) {
    const existing = this.groupSchedules().get(groupId);
    if (existing && !existing.error) return;

    const m = new Map(this.groupSchedules());
    m.set(groupId, { days: [], activities: [], loading: true, error: '' });
    this.groupSchedules.set(m);

    this.activitiesSvc.getGroupSchedule(groupId).subscribe({
      next: (data) => {
        const m2 = new Map(this.groupSchedules());
        m2.set(groupId, { ...data, loading: false, error: '' });
        this.groupSchedules.set(m2);
      },
      error: () => {
        const m2 = new Map(this.groupSchedules());
        m2.set(groupId, {
          days: [],
          activities: [],
          loading: false,
          error: 'Error al cargar el planning.',
        });
        this.groupSchedules.set(m2);
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
        this.formError.set(
          err.status === 409 ? 'Group code already exists.' : 'Error saving group.',
        );
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

  recomputeAggregates() {
    if (this.recomputing()) return;
    this.recomputing.set(true);
    this.svc.recomputeAggregates().subscribe({
      next: () => {
        this.recomputing.set(false);
        this.loadGroups();
      },
      error: () => {
        this.recomputing.set(false);
        alert('Error recomputing aggregates.');
      },
    });
  }

  aggStatusSummary(group: GuestGroup): string {
    const counts = group.agg_status_counts ?? {};
    return Object.entries(counts)
      .map(([status, count]) => `${count} ${status}`)
      .join(' · ');
  }

  openTruncate() {
    this.truncateConfirmText.set('');
    this.activeModal.set('truncate');
  }

  openDeleteFiltered() {
    this.truncateConfirmText.set('');
    this.activeModal.set('delete-filtered');
  }

  confirmTruncate() {
    if (this.truncateConfirmText() !== 'DELETE' || this.truncating()) return;
    this.truncating.set(true);
    this.svc.truncate().subscribe({
      next: () => {
        this.truncating.set(false);
        this.activeModal.set(null);
        this.loadGroups();
      },
      error: () => this.truncating.set(false),
    });
  }

  confirmDeleteFiltered() {
    if (this.truncateConfirmText() !== 'DELETE' || this.truncating()) return;
    this.truncating.set(true);
    const host = this.filterHost();
    this.svc
      .deleteFiltered({
        regionId: this.selectedRegionId() || undefined,
        search: this.searchCode().trim() || undefined,
        hostId: host && host !== '__none__' ? host : undefined,
        noHost: host === '__none__' ? true : undefined,
      })
      .subscribe({
        next: () => {
          this.truncating.set(false);
          this.activeModal.set(null);
          this.loadGroups();
        },
        error: () => this.truncating.set(false),
      });
  }

  closeModal() {
    this.activeModal.set(null);
  }

  compositionLabel(c: GroupComposition | null): string {
    return c ? COMPOSITION_LABELS[c] : '';
  }

  statusClass(status: Guest['status']): string {
    const map: Record<string, string> = {
      pending:
        'bg-yellow-50 text-yellow-700 ring-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:ring-yellow-800',
      confirmed:
        'bg-green-50 text-green-700 ring-green-200 dark:bg-green-950 dark:text-green-400 dark:ring-green-800',
      cancelled:
        'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950 dark:text-red-400 dark:ring-red-800',
      arrived:
        'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:ring-blue-800',
      blocked:
        'bg-gray-50 text-gray-600 ring-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700',
    };
    return map[status] ?? '';
  }
}
