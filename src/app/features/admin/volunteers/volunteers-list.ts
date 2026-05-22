import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { Region } from '../../../core/models/region.model';
import type {
  Volunteer,
  ImportVolunteerParseResponse,
  ImportVolunteerCommitResponse,
} from '../../../core/models/volunteer.model';
import { RegionsService } from '../../../core/services/regions.service';
import {
  VolunteersService,
  type VolunteerListQuery,
} from '../../../core/services/volunteers.service';

const DIAS = [
  { key: 'monday', label: 'M' },
  { key: 'tuesday', label: 'T' },
  { key: 'wednesday', label: 'W' },
  { key: 'thursday', label: 'T' },
  { key: 'friday', label: 'F' },
  { key: 'saturday', label: 'S' },
  { key: 'sunday', label: 'S' },
] as const;

type DiaKey = (typeof DIAS)[number]['key'];

@Component({
  selector: 'app-volunteers-list',
  imports: [FormsModule],
  templateUrl: './volunteers-list.html',
})
export class VolunteersListComponent implements OnInit {
  private readonly svc = inject(VolunteersService);
  private readonly regionsSvc = inject(RegionsService);

  readonly dias = DIAS;

  readonly regions = signal<Region[]>([]);
  readonly volunteers = signal<Volunteer[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly error = signal('');

  readonly filterRegion = signal('');
  readonly filterSearch = signal('');
  readonly filterActive = signal<'' | 'true' | 'false'>('');
  readonly page = signal(1);
  readonly limit = 50;

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.limit)));

  // Import modal
  readonly importModal = signal(false);
  readonly importStep = signal<'upload' | 'preview' | 'done'>('upload');
  readonly importing = signal(false);
  readonly importError = signal('');
  readonly parseResult = signal<ImportVolunteerParseResponse | null>(null);
  readonly commitResult = signal<ImportVolunteerCommitResponse | null>(null);
  isDragging = false;

  ngOnInit() {
    this.regionsSvc.getAll().subscribe({ next: (r) => this.regions.set(r) });
    this.load();
  }

  load() {
    this.loading.set(true);
    const query: VolunteerListQuery = {
      regionId: this.filterRegion() || undefined,
      search: this.filterSearch() || undefined,
      page: this.page(),
      limit: this.limit,
    };
    if (this.filterActive() !== '') {
      query.is_active = this.filterActive() === 'true';
    }
    this.svc.getAll(query).subscribe({
      next: (res) => {
        this.volunteers.set(res.data);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Error cargando voluntarios.');
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

  manana(v: Volunteer, dia: DiaKey): boolean {
    return v[`${dia}_morning` as keyof Volunteer] as boolean;
  }

  tarde(v: Volunteer, dia: DiaKey): boolean {
    return v[`${dia}_afternoon` as keyof Volunteer] as boolean;
  }

  mapsUrl(v: Volunteer): string | null {
    if (v.maps_link) return v.maps_link;
    if (v.lat && v.lng) return `https://www.google.com/maps?q=${v.lat},${v.lng}`;
    return null;
  }

  // ── Export ────────────────────────────────────────────────────────────────

  downloadExcel() {
    this.svc
      .exportExcel({
        regionId: this.filterRegion() || undefined,
        search: this.filterSearch() || undefined,
        is_active: this.filterActive() !== '' ? this.filterActive() === 'true' : undefined,
      })
      .subscribe((blob) => {
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

  // ── Import ────────────────────────────────────────────────────────────────

  openImport() {
    this.importModal.set(true);
    this.importStep.set('upload');
    this.importError.set('');
    this.parseResult.set(null);
    this.commitResult.set(null);
  }

  closeImport() {
    this.importModal.set(false);
  }

  onDragOver(e: DragEvent) {
    e.preventDefault();
    this.isDragging = true;
  }

  onDragLeave() {
    this.isDragging = false;
  }

  onDrop(e: DragEvent) {
    e.preventDefault();
    this.isDragging = false;
    const file = e.dataTransfer?.files[0];
    if (file) this.parseFile(file);
  }

  onFileSelected(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) this.parseFile(file);
  }

  parseFile(file: File) {
    this.importing.set(true);
    this.importError.set('');
    this.svc.parseImport(file).subscribe({
      next: (result) => {
        this.parseResult.set(result);
        this.importStep.set('preview');
        this.importing.set(false);
      },
      error: () => {
        this.importError.set('Error al procesar el archivo. Comprueba el formato.');
        this.importing.set(false);
      },
    });
  }

  confirmImport() {
    const result = this.parseResult();
    if (!result?.to_create.length) return;
    this.importing.set(true);
    this.svc.commitImport(result.to_create).subscribe({
      next: (res) => {
        this.commitResult.set(res);
        this.importStep.set('done');
        this.importing.set(false);
        this.load();
      },
      error: () => {
        this.importError.set('Error al importar. Inténtalo de nuevo.');
        this.importing.set(false);
      },
    });
  }
}
