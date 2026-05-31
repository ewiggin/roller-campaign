import { Component, inject, OnInit, signal } from '@angular/core';
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

@Component({
  selector: 'app-volunteers-list',
  imports: [FormsModule, RouterLink],
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

  filterRegion = '';
  filterSearch = '';
  page = 1;
  readonly limit = 50;

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total() / this.limit));
  }

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
    this.svc.getRoles().subscribe({ next: (r) => this.roles.set(r) });
    this.load();
  }

  load() {
    this.loading.set(true);
    this.svc.getAll({
      regionId: this.filterRegion || undefined,
      search: this.filterSearch || undefined,
      page: this.page,
      limit: this.limit,
    }).subscribe({
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
    this.page = 1;
    this.load();
  }

  prevPage() {
    if (this.page > 1) { this.page--; this.load(); }
  }

  nextPage() {
    if (this.page < this.totalPages) { this.page++; this.load(); }
  }

  downloadExcel() {
    this.svc.exportExcel({
      regionId: this.filterRegion || undefined,
      search: this.filterSearch || undefined,
    }).subscribe((blob) => {
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
    if (!result || result.to_create.length === 0) return;
    this.importing.set(true);
    this.importError.set('');
    this.svc.commitImport(result.to_create as ImportVolunteerRow[]).subscribe({
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
