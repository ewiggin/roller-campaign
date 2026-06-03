import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { GuestGroup } from '../../../core/models/guest-group.model';
import type {
  Guest,
  GuestStatus,
  ImportCommitResponse,
  ImportGuestRow,
  ImportParseResponse,
} from '../../../core/models/guest.model';
import type { Region } from '../../../core/models/region.model';
import { AuthService } from '../../../core/services/auth.service';
import { GuestGroupsService } from '../../../core/services/guest-groups.service';
import { GuestsService } from '../../../core/services/guests.service';
import { RegionsService } from '../../../core/services/regions.service';
import { SearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select';

const STATUSES: GuestStatus[] = ['pending', 'confirmed', 'cancelled', 'arrived', 'blocked'];

@Component({
  selector: 'app-guests-list',
  imports: [FormsModule, ReactiveFormsModule, RouterLink, DatePipe, SearchableSelectComponent],
  templateUrl: './guests-list.html',
})
export class GuestsListComponent implements OnInit {
  private readonly svc = inject(GuestsService);
  private readonly groupsSvc = inject(GuestGroupsService);
  private readonly regionsSvc = inject(RegionsService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

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
  readonly filterTermsAccepted = signal<'' | 'true' | 'false'>('');
  readonly page = signal(1);
  readonly limit = 50;

  readonly regionItems = computed(() =>
    this.regions().map((r) => ({ value: r.id, label: r.name })),
  );

  readonly filteredGroups = computed(() => {
    const rid = this.filterRegion();
    return rid ? this.groups().filter((g) => g.region_id === rid) : this.groups();
  });

  readonly filterGroupItems = computed(() =>
    this.filteredGroups().map((g) => ({
      value: g.id,
      label: g.group_code,
      meta: [g.host_name, `${g.guest_count} guests`].filter(Boolean).join(' · '),
    })),
  );

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.limit)));

  // Create modal
  readonly createModal = signal(false);
  readonly saving = signal(false);
  readonly formError = signal('');

  readonly createForm = this.fb.nonNullable.group({
    region_id: ['', Validators.required],
    group_id: ['', Validators.required],
    guest_code: ['', Validators.required],
    full_name: ['', Validators.required],
    is_minor: [false],
    native_language: [''],
    origin_city: [''],
    email: [''],
    branch: [''],
    is_group_contact: [false],
    is_special_servant: [false],
  });

  readonly createRegionId = signal('');

  readonly createFormGroupItems = computed(() =>
    this.groups()
      .filter((g) => g.region_id === this.createRegionId())
      .map((g) => ({
        value: g.id,
        label: g.group_code,
        meta: g.host_name ?? undefined,
      })),
  );

  openCreate() {
    const presetRegion = this.filterRegion() || '';
    this.createRegionId.set(presetRegion);
    this.createForm.reset({
      region_id: presetRegion,
      group_id: this.filterGroup() && presetRegion ? this.filterGroup() : '',
      guest_code: '',
      full_name: '',
      is_minor: false,
      native_language: '',
      origin_city: '',
      email: '',
      branch: '',
      is_group_contact: false,
      is_special_servant: false,
    });
    this.formError.set('');
    this.createModal.set(true);
  }

  onCreateRegionChange(id: string) {
    this.createRegionId.set(id);
    this.createForm.patchValue({ region_id: id, group_id: '' });
  }

  onCreateGroupChange(id: string) {
    this.createForm.patchValue({ group_id: id });
  }

  saveCreate() {
    if (this.createForm.invalid || this.saving()) return;
    this.saving.set(true);
    this.formError.set('');
    const v = this.createForm.getRawValue();
    const payload = {
      guest_code: v.guest_code,
      group_id: v.group_id,
      region_id: v.region_id,
      full_name: v.full_name,
      is_minor: v.is_minor,
      native_language: v.native_language || null,
      origin_city: v.origin_city || null,
      email: v.email || null,
      branch: v.branch || null,
      is_group_contact: v.is_group_contact,
      is_special_servant: v.is_special_servant,
    };
    this.svc.create(payload).subscribe({
      next: () => {
        this.createModal.set(false);
        this.saving.set(false);
        this.load();
      },
      error: (err: { status?: number }) => {
        this.formError.set(
          err.status === 409 ? 'El código de invitado ya existe.' : 'Error al crear el invitado.',
        );
        this.saving.set(false);
      },
    });
  }

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
  readonly importDeleteAbsent = signal(false);
  readonly importSelectedColumns = signal<string[]>([]);
  isDragging = false;

  private readonly REQUIRED_COLUMNS = new Set(['guest_code', 'group_code']);

  private readonly COLUMN_LABELS: Record<string, string> = {
    guest_code: 'Guest code',
    group_code: 'Group',
    full_name: 'Full name',
    is_minor: 'Minor',
    status: 'Status',
    branch: 'Branch',
    is_group_contact: 'Group contact',
    native_language: 'Language',
    other_languages: 'Other languages',
    speaks_english: 'Speaks English',
    is_special_servant: 'Special servant',
    origin_city: 'Origin city',
    email: 'Email',
    available_from: 'Available from',
    available_to: 'Available to',
    arrival_transport: 'Arrival transport',
    arrival_other_transport: 'Arrival other',
    arrival_date: 'Arrival date',
    arrival_time: 'Arrival time',
    arrival_place: 'Arrival place',
    arrival_airport: 'Arrival airport',
    arrival_airline: 'Arrival airline',
    arrival_flight: 'Arrival flight',
    real_arrival: 'Real arrival',
    real_arrival_time: 'Real arrival time',
    needs_airport_transfer: 'Airport transfer',
    departure_transport: 'Dep. transport',
    departure_other_transport: 'Dep. other',
    departure_date: 'Departure date',
    departure_time: 'Departure time',
    departure_place: 'Departure place',
    departure_airport: 'Dep. airport',
    departure_airline: 'Dep. airline',
    departure_flight: 'Dep. flight',
    real_departure: 'Real departure',
    real_departure_time: 'Real dep. time',
    accommodation: 'Accommodation',
    checkin_date: 'Check-in',
    checkout_date: 'Check-out',
    needs_special_accommodation: 'Special acc.',
    hosting_address: 'Hosting address',
    maps_link: 'Maps link',
    lat: 'Lat',
    lng: 'Lng',
    transport_mode: 'Transport mode',
    car_seats: 'Car seats',
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

  // Token modal
  readonly tokenModal = signal(false);
  readonly tokenData = signal<{ token: string; access_url: string } | null>(null);
  readonly tokenLoading = signal(false);

  ngOnInit() {
    this.regionsSvc.getAll().subscribe({
      next: (r) => {
        this.regions.set(r);
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
        termsAccepted:
          this.filterTermsAccepted() === '' ? undefined : this.filterTermsAccepted() === 'true',
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
    this.svc
      .exportExcel({
        regionId: this.filterRegion() || undefined,
        groupId: this.filterGroup() || undefined,
        status:
          (this.filterStatus() as import('../../../core/models/guest.model').GuestStatus) ||
          undefined,
        search: this.filterSearch() || undefined,
        termsAccepted:
          this.filterTermsAccepted() === '' ? undefined : this.filterTermsAccepted() === 'true',
      })
      .subscribe((blob) => {
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
    this.importDeleteAbsent.set(false);
    this.importSelectedColumns.set([]);
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
    if (creates > 0) parts.push(`Import ${creates} new`);
    if (updates > 0) {
      const colNote = selCols < allCols ? ` (${selCols} cols)` : '';
      parts.push(`update ${updates} existing${colNote}`);
    }
    if (this.importDeleteAbsent() && (result.toDelete?.length ?? 0) > 0)
      parts.push(`delete ${result.toDelete.length} absent`);
    return parts.join(' + ') || 'Import';
  }

  commitImport() {
    const result = this.parseResult();
    if (!result || !this.canCommit) return;
    this.importing.set(true);
    this.importError.set('');
    const regionId = this.importMode() === 'region' ? this.importRegionId() : undefined;
    const updateRows = this.importUpdateExisting() ? (result.duplicateRows ?? []) : undefined;
    const deleteAbsent = this.importDeleteAbsent() ? true : undefined;
    const toDeleteCodes = deleteAbsent ? result.toDelete?.map((g) => g.guest_code) : undefined;
    const selectedCols = this.importSelectedColumns();
    const allCols = result.columns ?? [];
    const isPartial = selectedCols.length < allCols.length;
    this.svc
      .commitImport(
        result.valid as ImportGuestRow[],
        updateRows,
        regionId,
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

  statusBadgeClass(status: GuestStatus): string {
    const map: Record<GuestStatus, string> = {
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
    return map[status];
  }
}
