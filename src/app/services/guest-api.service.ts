import { Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';

export interface GuestLookupData {
  guest_code: string;
  full_name: string;
  email: string | null;
  origin_city: string | null;
  car_seats: number | null;
  speaks_english: boolean;
  other_languages: string[] | null;
  real_arrival: string | null;
  real_arrival_time: string | null;
  real_departure: string | null;
  real_departure_time: string | null;
  hosting_address: string | null;
  lat: number | null;
  lng: number | null;
  transport_mode: string | null;
  arrival_other_transport: string | null;
  arrival_flight: string | null;
  needs_airport_transfer: boolean;
  region_name: string;
}

export interface GuestFormSubmitData {
  full_name: string;
  email: string;
  origin_city: string;
  car_seats: number;
  speaks_english: boolean;
  other_languages: string[] | null;
  real_arrival: string;
  real_arrival_time: string;
  real_departure: string;
  real_departure_time: string;
  hosting_address: string;
  lat: number | null;
  lng: number | null;
  transport_mode: string;
  arrival_other_transport: string | null;
  arrival_flight: string | null;
  needs_airport_transfer: boolean;
}

@Injectable({ providedIn: 'root' })
export class GuestApiService {
  readonly isLoading = signal(false);

  async lookup(code: string): Promise<GuestLookupData> {
    const response = await fetch(
      `${environment.apiUrl}/guest-access/lookup?code=${encodeURIComponent(code)}`,
    );
    if (response.status === 404) throw new Error('not_found');
    if (!response.ok) throw new Error('server_error');
    return response.json() as Promise<GuestLookupData>;
  }

  async submit(code: string, data: GuestFormSubmitData): Promise<void> {
    this.isLoading.set(true);
    try {
      const response = await fetch(
        `${environment.apiUrl}/guest-access/submit?code=${encodeURIComponent(code)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message ?? 'Error al guardar');
      }
    } finally {
      this.isLoading.set(false);
    }
  }
}
