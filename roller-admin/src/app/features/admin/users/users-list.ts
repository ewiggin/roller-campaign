import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { UsersService } from '../../../core/services/users.service';
import { RegionsService } from '../../../core/services/regions.service';
import { AuthService } from '../../../core/services/auth.service';
import type { User, UserRole } from '../../../core/models/user.model';
import type { Region } from '../../../core/models/region.model';

type ModalMode = 'create' | 'edit' | null;

const ROLES: UserRole[] = [
  'superadmin',
  'region_admin',
  'volunteer',
  'volunteer_manager',
  'guest_manager',
  'host_manager',
  'guest',
];

const ROLE_LABELS: Record<UserRole, string> = {
  superadmin: 'Superadmin',
  region_admin: 'Region Admin',
  volunteer: 'Volunteer',
  volunteer_manager: 'Volunteer Manager',
  guest_manager: 'Guest Manager',
  host_manager: 'Host Manager',
  guest: 'Guest',
};

@Component({
  selector: 'app-users-list',
  imports: [ReactiveFormsModule],
  templateUrl: './users-list.html',
})
export class UsersListComponent implements OnInit {
  private readonly svc = inject(UsersService);
  private readonly regionsSvc = inject(RegionsService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly currentUserId = signal(this.auth.currentUser()?.sub ?? '');
  readonly roles = ROLES;
  readonly roleLabels = ROLE_LABELS;

  readonly users = signal<User[]>([]);
  readonly regions = signal<Region[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  readonly modal = signal<ModalMode>(null);
  readonly saving = signal(false);
  readonly formError = signal('');
  private editingId = signal<string | null>(null);

  readonly selectedRegionIds = signal<Set<string>>(new Set());

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.minLength(8)]],
    role: ['region_admin' as UserRole, Validators.required],
  });

  readonly showRegions = computed(
    () => !['superadmin', 'guest'].includes(this.form.getRawValue().role),
  );

  ngOnInit() {
    this.load();
    this.loadRegions();
  }

  private load() {
    this.loading.set(true);
    this.svc.getAll().subscribe({
      next: (u) => {
        this.users.set(u);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Error loading users.');
        this.loading.set(false);
      },
    });
  }

  private loadRegions() {
    this.regionsSvc.getAll().subscribe({
      next: (r) => this.regions.set(r),
      error: () => {},
    });
  }

  openCreate() {
    this.editingId.set(null);
    this.form.reset({ email: '', password: '', role: 'region_admin' });
    this.form.get('password')!.setValidators([Validators.required, Validators.minLength(8)]);
    this.form.get('password')!.updateValueAndValidity();
    this.selectedRegionIds.set(new Set());
    this.formError.set('');
    this.modal.set('create');
  }

  openEdit(user: User) {
    this.editingId.set(user.id);
    this.form.setValue({ email: user.email, password: '', role: user.role });
    this.form.get('password')!.setValidators([Validators.minLength(8)]);
    this.form.get('password')!.updateValueAndValidity();
    this.selectedRegionIds.set(new Set(user.regions?.map((r) => r.id) ?? []));
    this.formError.set('');
    this.modal.set('edit');
  }

  toggleRegion(id: string) {
    this.selectedRegionIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  isRegionSelected(id: string) {
    return this.selectedRegionIds().has(id);
  }

  save() {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.formError.set('');

    const raw = this.form.getRawValue();
    const id = this.editingId();
    const region_ids = [...this.selectedRegionIds()];

    if (id) {
      const payload: Record<string, unknown> = { email: raw.email, role: raw.role, region_ids };
      if (raw.password) payload['password'] = raw.password;
      this.svc.update(id, payload).subscribe({
        next: () => this.onSaved(),
        error: (err) => this.onError(err),
      });
    } else {
      this.svc
        .create({ email: raw.email, password: raw.password, role: raw.role, region_ids })
        .subscribe({
          next: () => this.onSaved(),
          error: (err) => this.onError(err),
        });
    }
  }

  private onSaved() {
    this.modal.set(null);
    this.saving.set(false);
    this.load();
  }

  private onError(err: { status?: number }) {
    this.formError.set(err.status === 409 ? 'Email already in use.' : 'Error saving user.');
    this.saving.set(false);
  }

  deleteUser(user: User) {
    if (user.id === this.currentUserId()) {
      alert('You cannot delete your own account.');
      return;
    }
    if (!confirm(`Delete user "${user.email}"?`)) return;
    this.svc.remove(user.id).subscribe({
      next: () => this.load(),
      error: () => alert('Error deleting user.'),
    });
  }

  closeModal() {
    this.modal.set(null);
  }

  roleBadgeClass(role: UserRole): string {
    const map: Record<UserRole, string> = {
      superadmin:
        'bg-purple-50 text-purple-700 ring-purple-200 dark:bg-purple-950 dark:text-purple-400 dark:ring-purple-800',
      region_admin:
        'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:ring-blue-800',
      volunteer:
        'bg-green-50 text-green-700 ring-green-200 dark:bg-green-950 dark:text-green-400 dark:ring-green-800',
      volunteer_manager:
        'bg-teal-50 text-teal-700 ring-teal-200 dark:bg-teal-950 dark:text-teal-400 dark:ring-teal-800',
      guest_manager:
        'bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:ring-orange-800',
      host_manager:
        'bg-yellow-50 text-yellow-700 ring-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:ring-yellow-800',
      guest:
        'bg-gray-50 text-gray-600 ring-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700',
    };
    return map[role];
  }
}
