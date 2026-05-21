import { Component, HostListener, signal } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { GuestApiService, GuestFormSubmitData } from '../../services/guest-api.service';
import { LocationPickerComponent, PlaceResult } from '../location-picker/location-picker.component';
import { TERMS_VERSION } from '../../pages/legal/legal';

type Step = 'code' | 'form';

@Component({
  selector: 'app-guest-form',
  standalone: true,
  imports: [ReactiveFormsModule, LocationPickerComponent, RouterLink],
  templateUrl: './guest-form.component.html',
})
export class GuestFormComponent {
  readonly step = signal<Step>('code');
  readonly isValidating = signal(false);
  readonly codeError = signal<string | null>(null);
  readonly submitError = signal<string | null>(null);
  readonly submitSuccess = signal(false);
  readonly carAvailable = signal(false);
  readonly regionName = signal('');
  readonly selectedLanguages = signal<string[]>([]);
  private guestCode = '';

  readonly languages = [
    'Inglés',
    'Ruso',
    'Catalán',
    'Ucraniano',
    'Lengua de Signos Española',
    'Rumano',
    'Portugués',
  ];

  codeControl!: FormControl<string | null>;
  form!: FormGroup;

  constructor(
    private fb: FormBuilder,
    public apiService: GuestApiService,
  ) {
    this.codeControl = fb.control('', Validators.required);
    this.form = fb.group({
      nombreCompleto: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      ciudadOrigen: ['', Validators.required],
      plazasCoche: [0],
      fechaLlegada: ['', Validators.required],
      horaLlegada: ['', Validators.required],
      fechaSalida: ['', Validators.required],
      horaSalida: ['', Validators.required],
      direccionHospedaje: ['', Validators.required],
      latitud: [null as number | null],
      longitud: [null as number | null],
      medioTransporte: ['', Validators.required],
      medioTransporteOtro: [''],
      numeroVuelo: [''],
      necesitaTransporteAeropuerto: [false],
      aceptaCondiciones: [false, Validators.requiredTrue],
    });
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.step() === 'form' && !this.submitSuccess()) {
      event.preventDefault();
    }
  }

  async validateCode(): Promise<void> {
    const raw = this.codeControl.value?.trim() ?? '';
    const codigo = raw.replace(/^G-/i, '');
    if (!codigo) return;

    this.isValidating.set(true);
    this.codeError.set(null);

    try {
      const data = await this.apiService.lookup(codigo);
      this.guestCode = data.guest_code;
      this.regionName.set(data.region_name);
      this.prefillForm(data);
      this.step.set('form');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      this.codeError.set(
        message === 'not_found'
          ? 'Código no encontrado. Revisa que sea correcto.'
          : 'No se pudo verificar el código. Inténtalo de nuevo.',
      );
    } finally {
      this.isValidating.set(false);
    }
  }

  private prefillForm(data: import('../../services/guest-api.service').GuestLookupData): void {
    this.form.patchValue({
      nombreCompleto: '',
      email: '',
      ciudadOrigen: '',
      plazasCoche: 0,
      fechaLlegada: '',
      horaLlegada: '',
      fechaSalida: '',
      horaSalida: '',
      direccionHospedaje: '',
      latitud: undefined,
      longitud: undefined,
      medioTransporte: '',
      medioTransporteOtro: '',
      numeroVuelo: '',
      necesitaTransporteAeropuerto: false,
    });
    if ((data.car_seats ?? 0) > 0) {
      this.carAvailable.set(true);
    }
    const known = new Set(this.languages);
    this.selectedLanguages.set([]);
  }

  isInvalid(field: string): boolean {
    const control = this.form.get(field);
    return !!(control?.invalid && control?.touched);
  }

  incrementPlazas(): void {
    const v = this.form.get('plazasCoche')?.value ?? 0;
    if (v < 8) this.form.get('plazasCoche')?.setValue(v + 1);
  }

  decrementPlazas(): void {
    const v = this.form.get('plazasCoche')?.value ?? 0;
    if (v > 0) this.form.get('plazasCoche')?.setValue(v - 1);
  }

  toggleLanguage(lang: string): void {
    const current = this.selectedLanguages();
    this.selectedLanguages.set(
      current.includes(lang) ? current.filter((l) => l !== lang) : [...current, lang],
    );
  }

  onLocationSelected(place: PlaceResult | null): void {
    this.form.patchValue({
      direccionHospedaje: place?.address ?? '',
      latitud: place?.lat ?? null,
      longitud: place?.lng ?? null,
    });
  }

  get isOtroTransporte(): boolean {
    return this.form.get('medioTransporte')?.value === 'Otra';
  }

  get isAvion(): boolean {
    return this.form.get('medioTransporte')?.value === 'Avión';
  }

  onTransporteChange(): void {
    if (!this.isOtroTransporte) {
      this.form.get('medioTransporteOtro')?.setValue('');
    }
    if (!this.isAvion) {
      this.form.get('numeroVuelo')?.setValue('');
      this.form.get('necesitaTransporteAeropuerto')?.setValue(false);
    }
  }

  setCarAvailable(value: boolean): void {
    this.carAvailable.set(value);
    if (!value) {
      this.form.get('plazasCoche')?.patchValue(0);
    }
  }

  async onSubmit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.submitError.set(null);
    this.submitSuccess.set(false);

    const raw = this.form.getRawValue();
    const langs = this.selectedLanguages();
    const data: GuestFormSubmitData = {
      full_name: raw.nombreCompleto,
      email: raw.email,
      origin_city: raw.ciudadOrigen,
      car_seats: raw.plazasCoche ?? 0,
      speaks_english: langs.includes('Inglés'),
      other_languages: langs.length > 0 ? langs : null,
      real_arrival: raw.fechaLlegada,
      real_arrival_time: raw.horaLlegada,
      real_departure: raw.fechaSalida,
      real_departure_time: raw.horaSalida,
      hosting_address: raw.direccionHospedaje,
      lat: raw.latitud,
      lng: raw.longitud,
      transport_mode: raw.medioTransporte,
      arrival_other_transport: this.isOtroTransporte ? raw.medioTransporteOtro || null : null,
      arrival_flight: this.isAvion ? raw.numeroVuelo || null : null,
      needs_airport_transfer: this.isAvion ? raw.necesitaTransporteAeropuerto : false,
      terms_accepted: raw.aceptaCondiciones,
      terms_version: TERMS_VERSION,
    };

    try {
      await this.apiService.submit(this.guestCode, data);
      this.submitSuccess.set(true);
    } catch (err: unknown) {
      this.submitError.set(err instanceof Error ? err.message : 'Error desconocido al enviar');
    }
  }
}
