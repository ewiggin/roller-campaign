import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type { Region } from '../../../core/models/region.model';
import type { Volunteer, VolunteerRole } from '../../../core/models/volunteer.model';
import type { Host } from '../../../core/models/host.model';
import {
  LocationPickerComponent,
  type PlaceResult,
} from '../../../shared/components/location-picker/location-picker';
import {
  SearchableSelectComponent,
  type SearchableSelectItem,
} from '../../../shared/components/searchable-select/searchable-select';
import { RegionsService } from '../../../core/services/regions.service';
import { VolunteersService } from '../../../core/services/volunteers.service';
import { HostsService } from '../../../core/services/hosts.service';

type EditSection = 'contact' | 'identity' | 'roles' | 'location' | 'schedule' | null;

const DAYS: {
  key: string;
  label: string;
  morningField: keyof Volunteer;
  afternoonField: keyof Volunteer;
  outsideWeek?: boolean;
}[] = [
  {
    key: 'sat-prev',
    label: 'Sat',
    morningField: 'saturday_prev_morning',
    afternoonField: 'saturday_prev_afternoon',
    outsideWeek: true,
  },
  {
    key: 'sun-prev',
    label: 'Sun',
    morningField: 'sunday_prev_morning',
    afternoonField: 'sunday_prev_afternoon',
    outsideWeek: true,
  },
  { key: 'mon', label: 'Mon', morningField: 'monday_morning', afternoonField: 'monday_afternoon' },
  {
    key: 'tue',
    label: 'Tue',
    morningField: 'tuesday_morning',
    afternoonField: 'tuesday_afternoon',
  },
  {
    key: 'wed',
    label: 'Wed',
    morningField: 'wednesday_morning',
    afternoonField: 'wednesday_afternoon',
  },
  {
    key: 'thu',
    label: 'Thu',
    morningField: 'thursday_morning',
    afternoonField: 'thursday_afternoon',
  },
  { key: 'fri', label: 'Fri', morningField: 'friday_morning', afternoonField: 'friday_afternoon' },
  {
    key: 'sat',
    label: 'Sat',
    morningField: 'saturday_morning',
    afternoonField: 'saturday_afternoon',
  },
  { key: 'sun', label: 'Sun', morningField: 'sunday_morning', afternoonField: 'sunday_afternoon' },
  {
    key: 'mon-next',
    label: 'Mon',
    morningField: 'monday_next_morning',
    afternoonField: 'monday_next_afternoon',
    outsideWeek: true,
  },
];

@Component({
  selector: 'app-volunteer-detail',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    LocationPickerComponent,
    SearchableSelectComponent,
    DatePipe,
  ],
  providers: [DatePipe],
  templateUrl: './volunteer-detail.html',
})
export class VolunteerDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly svc = inject(VolunteersService);
  private readonly regionsSvc = inject(RegionsService);
  private readonly hostsSvc = inject(HostsService);
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
  readonly allRegions = signal<Region[]>([]);
  readonly selectedRegionIds = signal<string[]>([]);
  readonly allHosts = signal<Host[]>([]);
  readonly locationResult = signal<PlaceResult | null>(null);

  readonly days = DAYS;

  readonly regionNames = computed(
    () => (this.volunteer()?.regions ?? []).map((r) => r.name).join(', ') || '—',
  );

  readonly identityForm = this.fb.nonNullable.group({
    volunteer_code: [''],
    host_id: [''],
  });

  readonly contactForm = this.fb.nonNullable.group({
    full_name: [''],
    email: [''],
    phone: [''],
    is_active: [true],
  });

  readonly locationForm = this.fb.nonNullable.group({
    car_seats: [''],
  });

  readonly scheduleForm = this.fb.nonNullable.group({
    saturday_prev_morning: [false],
    saturday_prev_afternoon: [false],
    sunday_prev_morning: [false],
    sunday_prev_afternoon: [false],
    monday_morning: [false],
    monday_afternoon: [false],
    tuesday_morning: [false],
    tuesday_afternoon: [false],
    wednesday_morning: [false],
    wednesday_afternoon: [false],
    thursday_morning: [false],
    thursday_afternoon: [false],
    friday_morning: [false],
    friday_afternoon: [false],
    saturday_morning: [false],
    saturday_afternoon: [false],
    sunday_morning: [false],
    sunday_afternoon: [false],
    monday_next_morning: [false],
    monday_next_afternoon: [false],
  });

  readonly volunteerMapsLink = computed(() => {
    const v = this.volunteer();
    if (!v?.lat || !v?.lng) return null;
    return `https://www.google.com/maps?q=${v.lat},${v.lng}`;
  });

  readonly congregationMapsLink = computed(() => {
    const c = this.volunteer()?.congregation;
    if (!c?.lat || !c?.lng) return null;
    return `https://www.google.com/maps?q=${c.lat},${c.lng}`;
  });

  readonly availableHosts = computed(() => {
    const v = this.volunteer();
    if (!v?.regions?.length) return this.allHosts();
    const regionIds = new Set(v.regions.map((r) => r.id));
    return this.allHosts().filter((h) => regionIds.has(h.region_id));
  });

  readonly congregationItems = computed<SearchableSelectItem[]>(() =>
    this.availableHosts().map((h) => ({
      value: h.id,
      label: h.name,
      meta: h.address ?? undefined,
    })),
  );

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.svc.getRoles().subscribe({ next: (r) => this.allRoles.set(r) });
    this.regionsSvc.getAll().subscribe({ next: (r) => this.allRegions.set(r) });
    this.hostsSvc.getAll().subscribe({ next: (h) => this.allHosts.set(h) });
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

    if (section === 'identity') {
      this.identityForm.setValue({
        volunteer_code: v.volunteer_code,
        host_id: v.congregation?.id ?? '',
      });
      this.selectedRegionIds.set(v.regions.map((r) => r.id));
    } else if (section === 'contact') {
      this.contactForm.setValue({
        full_name: v.full_name,
        email: v.email ?? '',
        phone: v.phone ?? '',
        is_active: v.is_active,
      });
    } else if (section === 'roles') {
      this.selectedRoleIds.set(v.roles.map((r) => r.id));
    } else if (section === 'location') {
      this.locationForm.setValue({ car_seats: v.car_seats != null ? String(v.car_seats) : '' });
      this.locationResult.set(
        v.hosting_address && v.lat != null && v.lng != null
          ? { address: v.hosting_address, lat: v.lat, lng: v.lng }
          : null,
      );
    } else if (section === 'schedule') {
      this.scheduleForm.setValue({
        saturday_prev_morning: v.saturday_prev_morning,
        saturday_prev_afternoon: v.saturday_prev_afternoon,
        sunday_prev_morning: v.sunday_prev_morning,
        sunday_prev_afternoon: v.sunday_prev_afternoon,
        monday_morning: v.monday_morning,
        monday_afternoon: v.monday_afternoon,
        tuesday_morning: v.tuesday_morning,
        tuesday_afternoon: v.tuesday_afternoon,
        wednesday_morning: v.wednesday_morning,
        wednesday_afternoon: v.wednesday_afternoon,
        thursday_morning: v.thursday_morning,
        thursday_afternoon: v.thursday_afternoon,
        friday_morning: v.friday_morning,
        friday_afternoon: v.friday_afternoon,
        saturday_morning: v.saturday_morning,
        saturday_afternoon: v.saturday_afternoon,
        sunday_morning: v.sunday_morning,
        sunday_afternoon: v.sunday_afternoon,
        monday_next_morning: v.monday_next_morning,
        monday_next_afternoon: v.monday_next_afternoon,
      });
    }

    this.editSection.set(section);
  }

  toggleRole(roleId: string) {
    const current = this.selectedRoleIds();
    if (current.includes(roleId)) {
      this.selectedRoleIds.set(current.filter((id) => id !== roleId));
    } else {
      this.selectedRoleIds.set([...current, roleId]);
    }
  }

  isRegionSelected(regionId: string): boolean {
    return this.selectedRegionIds().includes(regionId);
  }

  toggleRegion(regionId: string) {
    const current = this.selectedRegionIds();
    if (current.includes(regionId)) {
      this.selectedRegionIds.set(current.filter((id) => id !== regionId));
    } else {
      this.selectedRegionIds.set([...current, regionId]);
    }
  }

  save() {
    const v = this.volunteer();
    if (!v || this.saving()) return;
    this.saving.set(true);
    this.saveError.set('');

    const section = this.editSection();
    let payload: Record<string, unknown> = {};

    if (section === 'identity') {
      const raw = this.identityForm.getRawValue();
      payload = {
        volunteer_code: raw.volunteer_code.trim(),
        region_ids: this.selectedRegionIds(),
        host_id: raw.host_id || null,
      };
    } else if (section === 'contact') {
      const raw = this.contactForm.getRawValue();
      payload = {
        full_name: raw.full_name,
        email: raw.email || null,
        phone: raw.phone || null,
        is_active: raw.is_active,
      };
    } else if (section === 'roles') {
      payload = { role_ids: this.selectedRoleIds() };
    } else if (section === 'location') {
      const raw = this.locationForm.getRawValue();
      const loc = this.locationResult();
      payload = {
        hosting_address: loc?.address ?? null,
        lat: loc?.lat ?? null,
        lng: loc?.lng ?? null,
        maps_link: loc ? `https://www.google.com/maps?q=${loc.lat},${loc.lng}` : null,
        car_seats: raw.car_seats !== '' ? parseInt(raw.car_seats, 10) : null,
      };
    } else if (section === 'schedule') {
      payload = this.scheduleForm.getRawValue();
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
