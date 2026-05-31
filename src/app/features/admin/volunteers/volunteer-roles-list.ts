import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { VolunteerRole } from '../../../core/models/volunteer.model';
import { AuthService } from '../../../core/services/auth.service';
import { VolunteersService } from '../../../core/services/volunteers.service';

@Component({
  selector: 'app-volunteer-roles-list',
  imports: [FormsModule],
  templateUrl: './volunteer-roles-list.html',
})
export class VolunteerRolesListComponent implements OnInit {
  private readonly svc = inject(VolunteersService);
  protected readonly auth = inject(AuthService);

  readonly roles = signal<VolunteerRole[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  readonly showForm = signal(false);
  readonly newName = signal('');
  readonly saving = signal(false);
  readonly saveError = signal('');

  readonly confirmDeleteId = signal<string | null>(null);
  readonly deleting = signal(false);

  ngOnInit() {
    this.load();
  }

  private load() {
    this.loading.set(true);
    this.svc.getRoles().subscribe({
      next: (r) => {
        this.roles.set(r);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Error loading roles.');
        this.loading.set(false);
      },
    });
  }

  openForm() {
    this.newName.set('');
    this.saveError.set('');
    this.showForm.set(true);
  }

  cancelForm() {
    this.showForm.set(false);
  }

  save() {
    const name = this.newName().trim();
    if (!name) return;
    this.saving.set(true);
    this.saveError.set('');
    this.svc.createRole(name).subscribe({
      next: (role) => {
        this.roles.update((r) => [...r, role]);
        this.saving.set(false);
        this.showForm.set(false);
      },
      error: () => {
        this.saveError.set('Could not create role. The name may already exist.');
        this.saving.set(false);
      },
    });
  }

  confirmDelete(id: string) {
    this.confirmDeleteId.set(id);
  }

  cancelDelete() {
    this.confirmDeleteId.set(null);
  }

  doDelete(id: string) {
    this.deleting.set(true);
    this.svc.deleteRole(id).subscribe({
      next: () => {
        this.roles.update((r) => r.filter((x) => x.id !== id));
        this.confirmDeleteId.set(null);
        this.deleting.set(false);
      },
      error: () => {
        this.error.set('Could not delete role. It may still be assigned to volunteers.');
        this.confirmDeleteId.set(null);
        this.deleting.set(false);
      },
    });
  }
}
