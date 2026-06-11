import { Injectable, signal } from "@angular/core";
import { environment } from "../../environments/environment";

export interface RegionOption {
  id: string;
  name: string;
}

export interface VolunteerLookupData {
  volunteer_code: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  car_seats: number | null;
  hosting_address: string | null;
  lat: number | null;
  lng: number | null;
  maps_link: string | null;
  monday_morning: boolean;
  monday_afternoon: boolean;
  tuesday_morning: boolean;
  tuesday_afternoon: boolean;
  wednesday_morning: boolean;
  wednesday_afternoon: boolean;
  thursday_morning: boolean;
  thursday_afternoon: boolean;
  friday_morning: boolean;
  friday_afternoon: boolean;
  saturday_morning: boolean;
  saturday_afternoon: boolean;
  sunday_morning: boolean;
  sunday_afternoon: boolean;
  saturday_prev_morning: boolean;
  saturday_prev_afternoon: boolean;
  sunday_prev_morning: boolean;
  sunday_prev_afternoon: boolean;
  monday_next_morning: boolean;
  monday_next_afternoon: boolean;
  regions: RegionOption[];
  terms_accepted: boolean | null;
  terms_accepted_at: string | null;
}

export interface VolunteerSubmitData {
  email: string;
  phone?: string | null;
  region_id: string;
  hosting_address?: string;
  lat?: number;
  lng?: number;
  maps_link?: string;
  car_seats: number;
  monday_morning: boolean;
  monday_afternoon: boolean;
  tuesday_morning: boolean;
  tuesday_afternoon: boolean;
  wednesday_morning: boolean;
  wednesday_afternoon: boolean;
  thursday_morning: boolean;
  thursday_afternoon: boolean;
  friday_morning: boolean;
  friday_afternoon: boolean;
  saturday_morning: boolean;
  saturday_afternoon: boolean;
  sunday_morning: boolean;
  sunday_afternoon: boolean;
  saturday_prev_morning: boolean;
  saturday_prev_afternoon: boolean;
  sunday_prev_morning: boolean;
  sunday_prev_afternoon: boolean;
  monday_next_morning: boolean;
  monday_next_afternoon: boolean;
  terms_accepted: boolean;
  terms_version: string;
}

@Injectable({ providedIn: "root" })
export class VolunteerApiService {
  readonly isLoading = signal(false);

  async getRegions(): Promise<RegionOption[]> {
    const response = await fetch(
      `${environment.apiUrl}/volunteer-access/regions`,
    );
    if (!response.ok) throw new Error("Error al cargar las regiones");
    return response.json() as Promise<RegionOption[]>;
  }

  async lookup(code: string): Promise<VolunteerLookupData | null> {
    const response = await fetch(
      `${environment.apiUrl}/volunteer-access/lookup?code=${encodeURIComponent(code)}`,
    );
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("Error al verificar el código");
    return response.json() as Promise<VolunteerLookupData>;
  }

  async submit(code: string, data: VolunteerSubmitData): Promise<void> {
    this.isLoading.set(true);
    try {
      const response = await fetch(
        `${environment.apiUrl}/volunteer-access/submit?code=${encodeURIComponent(code)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
          (body as { message?: string }).message ??
            "Error al enviar el formulario",
        );
      }
    } finally {
      this.isLoading.set(false);
    }
  }
}
