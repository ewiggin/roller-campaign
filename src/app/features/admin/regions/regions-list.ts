import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RegionsService } from '../../../core/services/regions.service';
import { AuthService } from '../../../core/services/auth.service';
import type { Region } from '../../../core/models/region.model';
import type { User } from '../../../core/models/user.model';

type ModalMode = 'create' | 'edit' | 'coordinators' | null;

@Component({
  selector: 'app-regions-list',
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './regions-list.html',
})
export class RegionsListComponent implements OnInit {
  private readonly svc = inject(RegionsService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly isSuperAdmin = this.auth.isSuperAdmin;

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
      (u) =>
        !coordinatorIds.has(u.id) &&
        (search === '' || u.email.toLowerCase().includes(search)),
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
}
