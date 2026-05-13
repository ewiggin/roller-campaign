import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HostsService } from '../../../core/services/hosts.service';
import { RegionsService } from '../../../core/services/regions.service';
import { AuthService } from '../../../core/services/auth.service';
import type { Host } from '../../../core/models/host.model';
import type { Region } from '../../../core/models/region.model';

type ModalMode = 'create' | 'edit' | null;

@Component({
  selector: 'app-hosts-list',
  imports: [ReactiveFormsModule, RouterLink],
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
  });

  readonly hostsByRegion = computed(() => {
    const rid = this.selectedRegionId();
    return rid ? this.hosts().filter((h) => h.region_id === rid) : this.hosts();
  });

  readonly regionName = computed(() =>
    this.regions().find((r) => r.id === this.selectedRegionId())?.name ?? '',
  );

  ngOnInit() {
    this.regionsSvc.getAll().subscribe({
      next: (r) => {
        this.regions.set(r);
        if (r.length > 0) {
          this.selectedRegionId.set(r[0].id);
          this.form.patchValue({ region_id: r[0].id });
        }
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
    { n: 1, label: 'L' }, { n: 2, label: 'M' }, { n: 3, label: 'X' },
    { n: 4, label: 'J' }, { n: 5, label: 'V' }, { n: 6, label: 'S' }, { n: 7, label: 'D' },
  ];

  openCreate() {
    this.editingId.set(null);
    this.form.reset({ name: '', region_id: this.selectedRegionId(), address: '', lat: null, lng: null,
      weekday_meeting_day: null, weekday_meeting_time: '',
      weekend_meeting_day: null, weekend_meeting_time: '' });
    this.formError.set('');
    this.modal.set('create');
  }

  openEdit(host: Host) {
    this.editingId.set(host.id);
    this.form.setValue({
      name: host.name, region_id: host.region_id, address: host.address ?? '',
      lat: host.lat, lng: host.lng,
      weekday_meeting_day: host.weekday_meeting_day,
      weekday_meeting_time: host.weekday_meeting_time ?? '',
      weekend_meeting_day: host.weekend_meeting_day,
      weekend_meeting_time: host.weekend_meeting_time ?? '',
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
    if (!confirm(`Delete congregation "${host.name}"? Groups assigned to it will be unassigned.`)) return;
    this.svc.remove(host.id).subscribe({
      next: () => this.load(),
      error: () => alert('Error deleting congregation.'),
    });
  }

  closeModal() {
    this.modal.set(null);
  }
}
