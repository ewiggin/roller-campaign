import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type { Volunteer, VolunteerRole } from '../../../core/models/volunteer.model';
import { VolunteersService } from '../../../core/services/volunteers.service';

type EditSection = 'contact' | 'roles' | null;

const DAYS: { key: string; label: string; morningField: keyof Volunteer; afternoonField: keyof Volunteer }[] = [
  { key: 'mon', label: 'Mon', morningField: 'monday_morning', afternoonField: 'monday_afternoon' },
  { key: 'tue', label: 'Tue', morningField: 'tuesday_morning', afternoonField: 'tuesday_afternoon' },
  { key: 'wed', label: 'Wed', morningField: 'wednesday_morning', afternoonField: 'wednesday_afternoon' },
  { key: 'thu', label: 'Thu', morningField: 'thursday_morning', afternoonField: 'thursday_afternoon' },
  { key: 'fri', label: 'Fri', morningField: 'friday_morning', afternoonField: 'friday_afternoon' },
  { key: 'sat', label: 'Sat', morningField: 'saturday_morning', afternoonField: 'saturday_afternoon' },
  { key: 'sun', label: 'Sun', morningField: 'sunday_morning', afternoonField: 'sunday_afternoon' },
];

@Component({
  selector: 'app-volunteer-detail',
  imports: [RouterLink, ReactiveFormsModule],
  providers: [DatePipe],
  templateUrl: './volunteer-detail.html',
})
export class VolunteerDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly svc = inject(VolunteersService);
  private readonly fb = inject(FormBuilder);
  private readonly datePipe = inject(DatePipe);

  readonly volunteer = signal<Volunteer | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly editSection = signal<EditSection>(null);
  readonly saving = signal(false);
  readonly saveError = signal('');
  readonly allRoles = signal<VolunteerRole[]>([]);
  readonly selectedRoleIds = signal<string[]>([]);

  readonly days = DAYS;

  readonly regionNames = computed(() =>
    (this.volunteer()?.regions ?? []).map(r => r.name).join(', ') || '—'
  );

  readonly contactForm = this.fb.nonNullable.group({
    full_name: [''],
    email: [''],
    phone: [''],
    is_active: [true],
  });

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.svc.getRoles().subscribe({ next: (r) => this.allRoles.set(r) });
    this.loadVolunteer(id);
  }

  private loadVolunteer(id: string) {
    this.loading.set(true);
    this.svc.getOne(id).subscribe({
      next: (v) => {
        this.volunteer.set(v);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Volunteer not found.');
        this.loading.set(false);
      },
    });
  }

  openEdit(section: EditSection) {
    const v = this.volunteer();
    if (!v) return;
    this.saveError.set('');

    if (section === 'contact') {
      this.contactForm.setValue({
        full_name: v.full_name,
        email: v.email ?? '',
        phone: v.phone ?? '',
        is_active: v.is_active,
      });
    } else if (section === 'roles') {
      this.selectedRoleIds.set(v.roles.map(r => r.id));
    }

    this.editSection.set(section);
  }

  toggleRole(roleId: string) {
    const current = this.selectedRoleIds();
    if (current.includes(roleId)) {
      this.selectedRoleIds.set(current.filter(id => id !== roleId));
    } else {
      this.selectedRoleIds.set([...current, roleId]);
    }
  }

  save() {
    const v = this.volunteer();
    if (!v || this.saving()) return;
    this.saving.set(true);
    this.saveError.set('');

    const section = this.editSection();
    let payload: Record<string, unknown> = {};

    if (section === 'contact') {
      const raw = this.contactForm.getRawValue();
      payload = {
        full_name: raw.full_name,
        email: raw.email || null,
        phone: raw.phone || null,
        is_active: raw.is_active,
      };
    } else if (section === 'roles') {
      payload = { role_ids: this.selectedRoleIds() };
    }

    this.svc.update(v.id, payload).subscribe({
      next: (updated) => {
        this.volunteer.set(updated);
        this.editSection.set(null);
        this.saving.set(false);
      },
      error: () => {
        this.saveError.set('Error saving changes.');
        this.saving.set(false);
      },
    });
  }

  closeModal() {
    this.editSection.set(null);
  }

  val(v: string | null | undefined): string {
    return v ?? '—';
  }

  fmtDate(v: string | null | undefined): string {
    if (!v) return '—';
    return this.datePipe.transform(v, 'd MMM yyyy') ?? v;
  }

  isRoleSelected(roleId: string): boolean {
    return this.selectedRoleIds().includes(roleId);
  }
}
