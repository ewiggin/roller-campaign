import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RegionsService } from '../../../core/services/regions.service';
import { AuthService } from '../../../core/services/auth.service';
import { downloadFile } from '../../../core/utils/download-file';
import {
  MenuButtonComponent,
  type MenuItem,
} from '../../../shared/components/menu-button/menu-button';
import type {
  Region,
  ImportRegionRow,
  ImportRegionParseResponse,
  ImportRegionCommitResponse,
} from '../../../core/models/region.model';
import type { User } from '../../../core/models/user.model';

type ModalMode = 'create' | 'edit' | 'coordinators' | null;

@Component({
  selector: 'app-regions-list',
  imports: [ReactiveFormsModule, DatePipe, MenuButtonComponent],
  templateUrl: './regions-list.html',
})
export class RegionsListComponent implements OnInit {
  private readonly svc = inject(RegionsService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly isSuperAdmin = this.auth.isSuperAdmin;

  readonly excelMenuItems = computed<MenuItem[]>(() => [
    { label: 'Export Excel', action: () => this.downloadExcel() },
    { label: 'Template', action: () => this.downloadTemplate() },
    { label: 'Import Excel', action: () => this.openImport() },
  ]);

  readonly regions = signal<Region[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  // Modal state
  readonly modal = signal<ModalMode>(null);
  readonly saving = signal(false);
  readonly formError = signal('');
  private editingId = signal<string | null>(null);

  readonly regionForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    event_start_date: [''],
    event_end_date: [''],
  });

  // Coordinators modal
  readonly coordRegion = signal<Region | null>(null);
  readonly allUsers = signal<User[]>([]);
  readonly userSearch = signal('');
  readonly addingCoord = signal(false);
  readonly coordError = signal('');

  readonly availableUsers = computed(() => {
    const region = this.coordRegion();
    const coordinatorIds = new Set(region?.coordinators.map((c) => c.id) ?? []);
    const search = this.userSearch().toLowerCase();
    return this.allUsers().filter(
      (u) => !coordinatorIds.has(u.id) && (search === '' || u.email.toLowerCase().includes(search)),
    );
  });

  ngOnInit() {
    this.load();
  }

  private load() {
    this.loading.set(true);
    this.svc.getAll().subscribe({
      next: (r) => {
        this.regions.set(r);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Error loading regions.');
        this.loading.set(false);
      },
    });
  }

  openCreate() {
    this.editingId.set(null);
    this.regionForm.reset();
    this.formError.set('');
    this.modal.set('create');
  }

  openEdit(region: Region) {
    this.editingId.set(region.id);
    this.regionForm.setValue({
      name: region.name,
      event_start_date: region.event_start_date ?? '',
      event_end_date: region.event_end_date ?? '',
    });
    this.formError.set('');
    this.modal.set('edit');
  }

  saveRegion() {
    if (this.regionForm.invalid || this.saving()) return;
    this.saving.set(true);
    this.formError.set('');

    const raw = this.regionForm.getRawValue();
    const payload = {
      name: raw.name,
      event_start_date: raw.event_start_date || null,
      event_end_date: raw.event_end_date || null,
    };

    const id = this.editingId();
    const req = id ? this.svc.update(id, payload) : this.svc.create(payload);

    req.subscribe({
      next: () => {
        this.modal.set(null);
        this.saving.set(false);
        this.load();
      },
      error: () => {
        this.formError.set('Error saving region.');
        this.saving.set(false);
      },
    });
  }

  deleteRegion(region: Region) {
    if (!confirm(`Delete region "${region.name}"?`)) return;
    this.svc.remove(region.id).subscribe({
      next: () => this.load(),
      error: () => alert('Error deleting region.'),
    });
  }

  openCoordinators(region: Region) {
    this.coordRegion.set(region);
    this.userSearch.set('');
    this.coordError.set('');
    this.modal.set('coordinators');

    this.svc.getUsers().subscribe({
      next: (users) => this.allUsers.set(users),
      error: () => this.coordError.set('Error loading users.'),
    });
  }

  addCoordinator(userId: string) {
    const region = this.coordRegion();
    if (!region) return;
    this.addingCoord.set(true);
    this.svc.addCoordinator(region.id, userId).subscribe({
      next: (updated) => {
        this.coordRegion.set(updated);
        this.regions.update((list) => list.map((r) => (r.id === updated.id ? updated : r)));
        this.addingCoord.set(false);
      },
      error: () => {
        this.coordError.set('Error adding coordinator.');
        this.addingCoord.set(false);
      },
    });
  }

  removeCoordinator(userId: string) {
    const region = this.coordRegion();
    if (!region) return;
    this.svc.removeCoordinator(region.id, userId).subscribe({
      next: (updated) => {
        this.coordRegion.set(updated);
        this.regions.update((list) => list.map((r) => (r.id === updated.id ? updated : r)));
      },
      error: () => this.coordError.set('Error removing coordinator.'),
    });
  }

  closeModal() {
    this.modal.set(null);
  }

  // ── Import ────────────────────────────────────────────────────────────────
  readonly importModal = signal(false);
  readonly importStep = signal<'upload' | 'preview' | 'done'>('upload');
  readonly importing = signal(false);
  readonly importError = signal('');
  readonly parseResult = signal<ImportRegionParseResponse | null>(null);
  readonly commitResult = signal<ImportRegionCommitResponse | null>(null);
  readonly importUpdateExisting = signal(false);
  isDragging = false;

  openImport() {
    this.importStep.set('upload');
    this.importError.set('');
    this.parseResult.set(null);
    this.commitResult.set(null);
    this.importUpdateExisting.set(false);
    this.importModal.set(true);
  }

  closeImport() {
    this.importModal.set(false);
    if (this.importStep() === 'done') this.load();
  }

  downloadExcel() {
    this.svc.exportExcel().subscribe((blob) => {
      void downloadFile(blob, 'regiones.xlsx');
    });
  }

  downloadTemplate() {
    this.svc.downloadTemplate().subscribe((blob) => {
      void downloadFile(blob, 'plantilla-regiones.xlsx');
    });
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

  get canCommit(): boolean {
    const r = this.parseResult();
    return !!(
      r &&
      (r.valid.length > 0 || (this.importUpdateExisting() && r.duplicateRows.length > 0))
    );
  }

  get commitLabel(): string {
    const r = this.parseResult();
    if (!r) return 'Import';
    const parts: string[] = [];
    if (r.valid.length > 0) parts.push(`Import ${r.valid.length} new`);
    if (this.importUpdateExisting() && r.duplicateRows.length > 0)
      parts.push(`update ${r.duplicateRows.length} existing`);
    return parts.join(' + ') || 'Import';
  }

  commitImport() {
    const r = this.parseResult();
    if (!r || !this.canCommit) return;
    this.importing.set(true);
    this.importError.set('');
    const updateRows = this.importUpdateExisting() ? r.duplicateRows : undefined;
    this.svc.commitImport(r.valid, updateRows).subscribe({
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
