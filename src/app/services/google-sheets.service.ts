import { Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';

export interface GuestFormData {
  codigoInvitado: string;
  nombreCompleto: string;
  email: string;
  fila: number;
  region: string;
  ciudadOrigen: string;
  plazasCoche: number;
  hablaIngles: boolean;
  fechaLlegada: string;
  horaLlegada: string;
  fechaSalida: string;
  horaSalida: string;
  direccionHospedaje: string;
  latitud: number | null;
  longitud: number | null;
  medioTransporte: string;
  medioTransporteOtro: string;
  numeroVuelo: string;
  necesitaTransporteAeropuerto: boolean;
}

@Injectable({ providedIn: 'root' })
export class GoogleSheetsService {
  readonly isLoading = signal(false);

  /** Devuelve el número de fila si el código existe, null si no. */
  async validateCode(codigo: string): Promise<number | null> {
    const url = `${environment.appsScriptUrl}?codigo=${encodeURIComponent(codigo)}`;
    const response = await fetch(url, { method: 'GET' });
    const data = await response.json();
    return data.valid === true ? (data.fila as number) : null;
  }

  async saveRow(data: GuestFormData): Promise<void> {
    this.isLoading.set(true);
    try {
      await fetch(environment.appsScriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          hablaIngles: data.hablaIngles ? 'Sí' : 'No',
        }),
      });
    } finally {
      this.isLoading.set(false);
    }
  }
}
