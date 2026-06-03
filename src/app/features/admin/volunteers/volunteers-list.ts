import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { Region } from '../../../core/models/region.model';
import type {
  ImportVolunteerCommitResponse,
  ImportVolunteerParseResponse,
  ImportVolunteerRow,
  VolunteerRole,
  VolunteerSummary,
} from '../../../core/models/volunteer.model';
import { RegionsService } from '../../../core/services/regions.service';
import { VolunteersService } from '../../../core/services/volunteers.service';
import { SearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select';

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
  imports: [FormsModule, RouterLink, SearchableSelectComponent],
  templateUrl: './volunteers-list.html',
})
export class VolunteersListComponent implements OnInit {
  private readonly svc = inject(VolunteersService);
  private readonly regionsSvc = inject(RegionsService);

  readonly regions = signal<Region[]>([]);
  readonly roles = signal<VolunteerRole[]>([]);
  readonly volunteers = signal<VolunteerSummary[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly error = signal('');

  readonly filterRegion = signal('');
  readonly filterRole = signal('');
  readonly filterMinCarSeats = signal('');
  readonly filterAvailability = signal<string[]>([]);
  readonly filterTermsAccepted = signal<'' | 'true' | 'false'>('');
  readonly filterSearch = signal('');
  readonly page = signal(1);
  readonly limit = 50;

  readonly regionItems = computed(() =>
    this.regions().map((r) => ({ value: r.id, label: r.name })),
  );

  readonly roleItems = computed(() => this.roles().map((r) => ({ value: r.id, label: r.name })));

  readonly availabilityOptions = AVAILABILITY_OPTIONS;

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.limit)));

  // Import modal
  readonly importModal = signal(false);
  readonly importStep = signal<'upload' | 'preview' | 'done'>('upload');
  readonly importing = signal(false);
  readonly importError = signal('');
  readonly parseResult = signal<ImportVolunteerParseResponse | null>(null);
  readonly commitResult = signal<ImportVolunteerCommitResponse | null>(null);
  readonly importDeleteAbsent = signal(false);
  isDragging = false;

  ngOnInit() {
    this.regionsSvc.getAll().subscribe({ next: (r) => this.regions.set(r) });
    this.svc.getRoles().subscribe({ next: (r) => this.roles.set(r) });
    this.load();
  }

  private buildQuery() {
    const minSeats = this.filterMinCarSeats();
    const slots = this.filterAvailability();
    const terms = this.filterTermsAccepted();
    return {
      regionId: this.filterRegion() || undefined,
      roleId: this.filterRole() || undefined,
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
    this.filterMinCarSeats.set('');
    this.filterAvailability.set([]);
    this.filterTermsAccepted.set('');
    this.filterSearch.set('');
    this.applyFilters();
  }

  readonly hasActiveFilters = computed(
    () =>
      !!this.filterRegion() ||
      !!this.filterRole() ||
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

  downloadExcel() {
    this.svc.exportExcel(this.buildQuery()).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'voluntarios.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  downloadTemplate() {
    this.svc.downloadTemplate().subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'plantilla-voluntarios.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  openImport() {
    this.importStep.set('upload');
    this.importError.set('');
    this.parseResult.set(null);
    this.importDeleteAbsent.set(false);
    this.commitResult.set(null);
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
    this.importing.set(true);
    this.importError.set('');
    this.svc.parseImport(file).subscribe({
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

  commitImport() {
    const result = this.parseResult();
    const canCommit =
      result &&
      (result.to_create.length > 0 ||
        (this.importDeleteAbsent() && (result.to_delete?.length ?? 0) > 0));
    if (!canCommit) return;
    this.importing.set(true);
    this.importError.set('');
    const deleteAbsent = this.importDeleteAbsent() ? true : undefined;
    const toDeleteCodes = deleteAbsent ? (result!.to_delete ?? []) : undefined;
    this.svc
      .commitImport(result!.to_create as ImportVolunteerRow[], deleteAbsent, toDeleteCodes)
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
}
