import { Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';

export interface VolunteerFormData {
  codigoVoluntario: string;
  fila: number;
  direccion: string;
  mapsLink: string;
  lat: number;
  lon: number;
  plazasCoche: number;
  lunesManana: boolean;
  lunesTarde: boolean;
  martesManana: boolean;
  martesTarde: boolean;
  miercolesManana: boolean;
  miercolesTarde: boolean;
  juevesManana: boolean;
  juevesTarde: boolean;
  viernesManana: boolean;
  viernesTarde: boolean;
  sabadoManana: boolean;
  sabadoTarde: boolean;
  domingoManana: boolean;
  domingoTarde: boolean;
}

export interface ValidateResult {
  fila: number;
  nombre: string;
}

@Injectable({ providedIn: 'root' })
export class GoogleSheetsService {
  readonly isLoading = signal(false);

  async validateCode(codigo: string): Promise<ValidateResult | null> {
    const url = `${environment.appsScriptUrl}?codigo=${encodeURIComponent(codigo)}`;
    const response = await fetch(url, { method: 'GET' });
    const data = await response.json();
    return data.valid === true ? { fila: data.fila as number, nombre: data.nombre as string } : null;
  }

  async saveRow(data: VolunteerFormData): Promise<void> {
    this.isLoading.set(true);
    try {
      await fetch(environment.appsScriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    } finally {
      this.isLoading.set(false);
    }
  }
}
