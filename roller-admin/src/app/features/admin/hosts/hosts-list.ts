import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select';
import { HostsService } from '../../../core/services/hosts.service';
import { RegionsService } from '../../../core/services/regions.service';
import { AuthService } from '../../../core/services/auth.service';
import type {
  Host,
  ImportHostRow,
  ImportHostParseResponse,
  ImportHostCommitResponse,
} from '../../../core/models/host.model';
import type { Region } from '../../../core/models/region.model';

type ModalMode = 'create' | 'edit' | null;

@Component({
  selector: 'app-hosts-list',
  imports: [ReactiveFormsModule, RouterLink, SearchableSelectComponent],
  templateUrl: './hosts-list.html',
})
export class HostsListComponent implements OnInit {
  private readonly svc = inject(HostsService);
  private readonly regionsSvc = inject(RegionsService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly isSuperAdmin = this.auth.isSuperAdmin;

  readonly regions = signal<Region[]>([]);
  readonly hosts = signal<Host[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly selectedRegionId = signal('');

  readonly modal = signal<ModalMode>(null);
  readonly saving = signal(false);
  readonly formError = signal('');
  private editingId = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    region_id: ['', Validators.required],
    address: [''],
    lat: [null as number | null],
    lng: [null as number | null],
    weekday_meeting_day: [null as number | null],
    weekday_meeting_time: [''],
    weekend_meeting_day: [null as number | null],
    weekend_meeting_time: [''],
    capacity: [null as number | null],
    note: [''],
  });

  readonly regionItems = computed(() =>
    this.regions().map((r) => ({ value: r.id, label: r.name })),
  );

  readonly hostsByRegion = computed(() => {
    const rid = this.selectedRegionId();
    return rid ? this.hosts().filter((h) => h.region_id === rid) : this.hosts();
  });

  readonly regionName = computed(
    () => this.regions().find((r) => r.id === this.selectedRegionId())?.name ?? '',
  );

  ngOnInit() {
    this.regionsSvc.getAll().subscribe({
      next: (r) => {
        this.regions.set(r);
        if (r.length > 0) this.form.patchValue({ region_id: r[0].id });
        this.load();
      },
      error: () => {
        this.error.set('Error loading regions.');
        this.loading.set(false);
      },
    });
  }

  private load() {
    this.loading.set(true);
    this.svc.getAll().subscribe({
      next: (h) => {
        this.hosts.set(h);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Error loading hosts.');
        this.loading.set(false);
      },
    });
  }

  selectRegion(id: string) {
    this.selectedRegionId.set(id);
  }

  readonly days = [
    { n: 1, label: 'L' },
    { n: 2, label: 'M' },
    { n: 3, label: 'X' },
    { n: 4, label: 'J' },
    { n: 5, label: 'V' },
    { n: 6, label: 'S' },
    { n: 7, label: 'D' },
  ];

  openCreate() {
    this.editingId.set(null);
    this.form.reset({
      name: '',
      region_id: this.selectedRegionId(),
      address: '',
      lat: null,
      lng: null,
      weekday_meeting_day: null,
      weekday_meeting_time: '',
      weekend_meeting_day: null,
      weekend_meeting_time: '',
      capacity: null,
      note: '',
    });
    this.formError.set('');
    this.modal.set('create');
  }

  openEdit(host: Host) {
    this.editingId.set(host.id);
    this.form.setValue({
      name: host.name,
      region_id: host.region_id,
      address: host.address ?? '',
      lat: host.lat,
      lng: host.lng,
      weekday_meeting_day: host.weekday_meeting_day,
      weekday_meeting_time: host.weekday_meeting_time ?? '',
      weekend_meeting_day: host.weekend_meeting_day,
      weekend_meeting_time: host.weekend_meeting_time ?? '',
      capacity: host.capacity ?? null,
      note: host.note ?? '',
    });
    this.formError.set('');
    this.modal.set('edit');
  }

  setDay(field: 'weekday_meeting_day' | 'weekend_meeting_day', day: number) {
    const current = this.form.get(field)!.value;
    this.form.get(field)!.setValue(current === day ? null : day);
  }

  save() {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.formError.set('');

    const raw = this.form.getRawValue();
    const id = this.editingId();
    const payload = {
      name: raw.name,
      address: raw.address || null,
      lat: raw.lat,
      lng: raw.lng,
      weekday_meeting_day: raw.weekday_meeting_day,
      weekday_meeting_time: raw.weekday_meeting_time || null,
      weekend_meeting_day: raw.weekend_meeting_day,
      weekend_meeting_time: raw.weekend_meeting_time || null,
      capacity: raw.capacity,
      note: raw.note || null,
    };

    const req = id
      ? this.svc.update(id, payload)
      : this.svc.create({ ...payload, region_id: raw.region_id });

    req.subscribe({
      next: () => {
        this.modal.set(null);
        this.saving.set(false);
        this.load();
      },
      error: () => {
        this.formError.set('Error saving congregation.');
        this.saving.set(false);
      },
    });
  }

  delete(host: Host) {
    if (!confirm(`Delete congregation "${host.name}"? Groups assigned to it will be unassigned.`))
      return;
    this.svc.remove(host.id).subscribe({
      next: () => this.load(),
      error: () => alert('Error deleting congregation.'),
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
  readonly parseResult = signal<ImportHostParseResponse | null>(null);
  readonly commitResult = signal<ImportHostCommitResponse | null>(null);
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
    this.svc.exportExcel(this.selectedRegionId() || undefined).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'congregaciones.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  downloadAssignedGroupsPdf() {
    const regionId = this.selectedRegionId();
    this.svc.exportAssignedGroupsPdf(regionId || undefined).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'grupos-asignados.pdf';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  downloadTemplate() {
    this.svc.downloadTemplate().subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'plantilla-congregaciones.xlsx';
      a.click();
      URL.revokeObjectURL(url);
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
