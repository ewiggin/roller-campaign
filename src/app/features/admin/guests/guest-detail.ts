import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { GuestGroup } from '../../../core/models/guest-group.model';
import type { Guest, GuestStatus, TransportMode } from '../../../core/models/guest.model';
import type { Region } from '../../../core/models/region.model';
import { AuthService } from '../../../core/services/auth.service';
import { GuestGroupsService } from '../../../core/services/guest-groups.service';
import { GuestsService } from '../../../core/services/guests.service';
import { RegionsService } from '../../../core/services/regions.service';

type EditSection =
  | 'identity'
  | 'languages'
  | 'arrival'
  | 'departure'
  | 'accommodation'
  | 'migrate'
  | null;

const STATUSES: GuestStatus[] = ['pending', 'confirmed', 'cancelled', 'arrived', 'blocked'];
const TRANSPORTS: TransportMode[] = ['car', 'bus', 'train', 'plane', 'ferry', 'motorbike', 'other'];

@Component({
  selector: 'app-guest-detail',
  imports: [RouterLink, ReactiveFormsModule, DatePipe],
  providers: [DatePipe],
  templateUrl: './guest-detail.html',
})
export class GuestDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly svc = inject(GuestsService);
  private readonly groupsSvc = inject(GuestGroupsService);
  private readonly regionsSvc = inject(RegionsService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly isSuperAdmin = this.auth.isSuperAdmin;
  readonly statuses = STATUSES;
  readonly transports = TRANSPORTS;

  readonly guest = signal<Guest | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  readonly regions = signal<Region[]>([]);
  readonly groups = signal<GuestGroup[]>([]);

  readonly editSection = signal<EditSection>(null);
  readonly saving = signal(false);
  readonly saveError = signal('');

  // Token
  readonly tokenData = signal<{ token: string; access_url: string } | null>(null);
  readonly tokenModal = signal(false);
  readonly tokenLoading = signal(false);

  readonly regionName = computed(() => {
    const g = this.guest();
    return this.regions().find((r) => r.id === g?.region_id)?.name ?? '';
  });

  readonly groupCode = computed(() => {
    const g = this.guest();
    return this.groups().find((gr) => gr.id === g?.group_id)?.group_code ?? '';
  });

  readonly availableGroupsForMigrate = computed(() => {
    const g = this.guest();
    return this.groups().filter((gr) => gr.region_id === g?.region_id && gr.id !== g?.group_id);
  });

  // ─── Forms per section ───────────────────────────────────────────────────

  readonly identityForm = this.fb.nonNullable.group({
    full_name: [''],
    status: ['pending' as GuestStatus],
    branch: [''],
    origin_city: [''],
    email: [''],
    available_from: [''],
    available_to: [''],
    is_minor: [false],
    is_group_contact: [false],
    is_special_servant: [false],
    car_seats: [null as number | null],
  });

  readonly languagesForm = this.fb.nonNullable.group({
    native_language: [''],
    other_languages: [''],
    speaks_english: [false],
  });

  readonly arrivalForm = this.fb.nonNullable.group({
    arrival_transport: ['' as TransportMode | ''],
    arrival_other_transport: [''],
    arrival_date: [''],
    arrival_time: [''],
    arrival_place: [''],
    arrival_airport: [''],
    arrival_airline: [''],
    arrival_flight: [''],
    real_arrival: [''],
    real_arrival_time: [''],
    needs_airport_transfer: [false],
  });

  readonly departureForm = this.fb.nonNullable.group({
    departure_transport: ['' as TransportMode | ''],
    departure_other_transport: [''],
    departure_date: [''],
    departure_time: [''],
    departure_place: [''],
    departure_airport: [''],
    departure_airline: [''],
    departure_flight: [''],
    real_departure: [''],
    real_departure_time: [''],
  });

  readonly accommodationForm = this.fb.nonNullable.group({
    accommodation: [''],
    checkin_date: [''],
    checkout_date: [''],
    needs_special_accommodation: [false],
    hosting_address: [''],
    maps_link: [''],
    lat: [null as number | null],
    lng: [null as number | null],
    transport_mode: [''],
  });

  readonly migrateForm = this.fb.nonNullable.group({
    targetGroupId: [''],
  });

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.regionsSvc.getAll().subscribe({ next: (r) => this.regions.set(r) });
    this.groupsSvc.getAll().subscribe({ next: (g) => this.groups.set(g.data) });
    this.loadGuest(id);
  }

  private loadGuest(id: string) {
    this.loading.set(true);
    this.svc.getOne(id).subscribe({
      next: (g) => {
        this.guest.set(g);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Guest not found.');
        this.loading.set(false);
      },
    });
  }

  openEdit(section: EditSection) {
    const g = this.guest();
    if (!g) return;
    this.saveError.set('');

    if (section === 'identity') {
      this.identityForm.setValue({
        full_name: g.full_name,
        status: g.status,
        branch: g.branch ?? '',
        origin_city: g.origin_city ?? '',
        email: g.email ?? '',
        available_from: g.available_from ?? '',
        available_to: g.available_to ?? '',
        is_minor: g.is_minor,
        is_group_contact: g.is_group_contact,
        is_special_servant: g.is_special_servant,
        car_seats: g.car_seats,
      });
    } else if (section === 'languages') {
      this.languagesForm.setValue({
        native_language: g.native_language ?? '',
        other_languages: (g.other_languages ?? []).join(', '),
        speaks_english: g.speaks_english,
      });
    } else if (section === 'arrival') {
      this.arrivalForm.setValue({
        arrival_transport: g.arrival_transport ?? '',
        arrival_other_transport: g.arrival_other_transport ?? '',
        arrival_date: g.arrival_date ?? '',
        arrival_time: g.arrival_time ?? '',
        arrival_place: g.arrival_place ?? '',
        arrival_airport: g.arrival_airport ?? '',
        arrival_airline: g.arrival_airline ?? '',
        arrival_flight: g.arrival_flight ?? '',
        real_arrival: g.real_arrival ?? '',
        real_arrival_time: g.real_arrival_time ?? '',
        needs_airport_transfer: g.needs_airport_transfer,
      });
    } else if (section === 'departure') {
      this.departureForm.setValue({
        departure_transport: g.departure_transport ?? '',
        departure_other_transport: g.departure_other_transport ?? '',
        departure_date: g.departure_date ?? '',
        departure_time: g.departure_time ?? '',
        departure_place: g.departure_place ?? '',
        departure_airport: g.departure_airport ?? '',
        departure_airline: g.departure_airline ?? '',
        departure_flight: g.departure_flight ?? '',
        real_departure: g.real_departure ?? '',
        real_departure_time: g.real_departure_time ?? '',
      });
    } else if (section === 'accommodation') {
      this.accommodationForm.setValue({
        accommodation: g.accommodation ?? '',
        checkin_date: g.checkin_date ?? '',
        checkout_date: g.checkout_date ?? '',
        needs_special_accommodation: g.needs_special_accommodation,
        hosting_address: g.hosting_address ?? '',
        maps_link: g.maps_link ?? '',
        lat: g.lat,
        lng: g.lng,
        transport_mode: g.transport_mode ?? '',
      });
    } else if (section === 'migrate') {
      const first = this.availableGroupsForMigrate()[0];
      this.migrateForm.setValue({ targetGroupId: first?.id ?? '' });
    }

    this.editSection.set(section);
  }

  save() {
    const g = this.guest();
    if (!g || this.saving()) return;
    this.saving.set(true);
    this.saveError.set('');

    const section = this.editSection();
    let payload: Partial<Guest> = {};

    if (section === 'identity') {
      const raw = this.identityForm.getRawValue();
      payload = {
        ...raw,
        branch: raw.branch || null,
        origin_city: raw.origin_city || null,
        email: raw.email || null,
        available_from: raw.available_from || null,
        available_to: raw.available_to || null,
        car_seats: raw.car_seats,
      };
    } else if (section === 'languages') {
      const raw = this.languagesForm.getRawValue();
      payload = {
        native_language: raw.native_language || null,
        other_languages: raw.other_languages
          ? raw.other_languages
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : null,
        speaks_english: raw.speaks_english,
      };
    } else if (section === 'arrival') {
      const raw = this.arrivalForm.getRawValue();
      payload = {
        arrival_transport: (raw.arrival_transport as TransportMode) || null,
        arrival_other_transport: raw.arrival_other_transport || null,
        arrival_date: raw.arrival_date || null,
        arrival_time: raw.arrival_time || null,
        arrival_place: raw.arrival_place || null,
        arrival_airport: raw.arrival_airport || null,
        arrival_airline: raw.arrival_airline || null,
        arrival_flight: raw.arrival_flight || null,
        real_arrival: raw.real_arrival || null,
        real_arrival_time: raw.real_arrival_time || null,
        needs_airport_transfer: raw.needs_airport_transfer,
      };
    } else if (section === 'departure') {
      const raw = this.departureForm.getRawValue();
      payload = {
        departure_transport: (raw.departure_transport as TransportMode) || null,
        departure_other_transport: raw.departure_other_transport || null,
        departure_date: raw.departure_date || null,
        departure_time: raw.departure_time || null,
        departure_place: raw.departure_place || null,
        departure_airport: raw.departure_airport || null,
        departure_airline: raw.departure_airline || null,
        departure_flight: raw.departure_flight || null,
        real_departure: raw.real_departure || null,
        real_departure_time: raw.real_departure_time || null,
      };
    } else if (section === 'accommodation') {
      const raw = this.accommodationForm.getRawValue();
      payload = {
        accommodation: raw.accommodation || null,
        checkin_date: raw.checkin_date || null,
        checkout_date: raw.checkout_date || null,
        needs_special_accommodation: raw.needs_special_accommodation,
        hosting_address: raw.hosting_address || null,
        maps_link: raw.maps_link || null,
        lat: raw.lat,
        lng: raw.lng,
        transport_mode: raw.transport_mode || null,
      };
    }

    this.svc.update(g.id, payload).subscribe({
      next: (updated) => {
        this.guest.set(updated);
        this.editSection.set(null);
        this.saving.set(false);
      },
      error: () => {
        this.saveError.set('Error saving changes.');
        this.saving.set(false);
      },
    });
  }

  migrate() {
    const g = this.guest();
    if (!g || this.saving()) return;
    const targetGroupId = this.migrateForm.getRawValue().targetGroupId;
    if (!targetGroupId) return;
    this.saving.set(true);
    this.saveError.set('');
    this.svc.migrate(g.id, targetGroupId).subscribe({
      next: (updated) => {
        this.guest.set(updated);
        this.editSection.set(null);
        this.saving.set(false);
      },
      error: () => {
        this.saveError.set('Error migrating guest.');
        this.saving.set(false);
      },
    });
  }

  showToken() {
    this.tokenLoading.set(true);
    this.tokenModal.set(true);
    this.tokenData.set(null);
    this.svc.generateToken(this.guest()!.id).subscribe({
      next: (data) => {
        this.tokenData.set(data);
        this.tokenLoading.set(false);
      },
      error: () => {
        this.tokenLoading.set(false);
        this.tokenModal.set(false);
      },
    });
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  closeModal() {
    this.editSection.set(null);
  }

  statusBadgeClass(status: GuestStatus): string {
    const map: Record<GuestStatus, string> = {
      pending:
        'bg-yellow-50 text-yellow-700 ring-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:ring-yellow-800',
      confirmed:
        'bg-green-50 text-green-700 ring-green-200 dark:bg-green-950 dark:text-green-400 dark:ring-green-800',
      cancelled:
        'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950 dark:text-red-400 dark:ring-red-800',
      arrived:
        'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:ring-blue-800',
      blocked:
        'bg-gray-50 text-gray-600 ring-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700',
    };
    return map[status];
  }

  private readonly datePipe = inject(DatePipe);

  val(v: string | null | undefined): string {
    return v ?? '—';
  }

  fmtDate(v: string | null | undefined): string {
    if (!v) return '—';
    const formatted = this.datePipe.transform(v, 'd MMM yyyy');
    return formatted ?? v;
  }

  fmtTime(v: string | null | undefined): string {
    return v ?? '';
  }
}
