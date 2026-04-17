import { Component, signal } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { GuestFormData, GoogleSheetsService } from '../../services/google-sheets.service';
import { LocationPickerComponent, PlaceResult } from '../location-picker/location-picker.component';

type Step = 'code' | 'form';

@Component({
  selector: 'app-guest-form',
  standalone: true,
  imports: [ReactiveFormsModule, LocationPickerComponent],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div class="max-w-lg mx-auto">

        <!-- Header -->
        <div class="text-center mb-8">
          <div class="text-5xl mb-3">🛒🏖️</div>
          <h1 class="text-3xl font-bold text-indigo-800">Carritos se van de vacaciones</h1>
          <p class="text-gray-600 mt-2">Rellena el formulario para coordinar el viaje</p>
        </div>

        <!-- PASO 1: Código de invitado -->
        @if (step() === 'code') {
          <div class="bg-white rounded-2xl shadow-lg p-6 space-y-4">
            <div class="space-y-1">
              <label class="block text-sm font-semibold text-gray-700">
                Código de invitado <span class="text-red-500">*</span>
              </label>
              <p class="text-xs text-gray-500">Introduce el código que has recibido para acceder al formulario</p>
              <input
                type="text"
                [formControl]="codeControl"
                (keydown.enter)="validateCode()"
                placeholder="Ej. INV-0042"
                class="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition uppercase"
                [class.border-red-400]="codeError()"
                [disabled]="isValidating()"
              />
              @if (codeError()) {
                <p class="text-xs text-red-500">{{ codeError() }}</p>
              }
            </div>
            <button
              type="button"
              (click)="validateCode()"
              [disabled]="isValidating() || !codeControl.value"
              class="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm"
            >
              @if (isValidating()) {
                <span class="inline-flex items-center gap-2 justify-center">
                  <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Verificando...
                </span>
              } @else {
                Continuar
              }
            </button>
          </div>
        }

        <!-- PASO 2: Formulario -->
        @if (step() === 'form') {
          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="bg-white rounded-2xl shadow-lg p-6 space-y-5">

            <!-- Código confirmado -->
            <div class="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2">
              <span class="text-indigo-500">🎟️</span>
              <span class="text-sm text-indigo-800 font-medium">Código: {{ codeControl.value }}</span>
              <button
                type="button"
                (click)="step.set('code')"
                class="ml-auto text-xs text-indigo-500 hover:text-indigo-700 underline"
              >Cambiar</button>
            </div>

            <!-- Nombre completo -->
            <div class="space-y-1">
              <label class="block text-sm font-semibold text-gray-700">
                Nombre completo <span class="text-red-500">*</span>
              </label>
              <input
                type="text"
                formControlName="nombreCompleto"
                placeholder="Nombre y apellidos"
                class="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
                [class.border-red-400]="isInvalid('nombreCompleto')"
              />
              @if (isInvalid('nombreCompleto')) {
                <p class="text-xs text-red-500">Este campo es obligatorio</p>
              }
            </div>

            <!-- Ciudad de origen -->
            <div class="space-y-1">
              <label class="block text-sm font-semibold text-gray-700">
                Ciudad de origen <span class="text-red-500">*</span>
              </label>
              <input
                type="text"
                formControlName="ciudadOrigen"
                placeholder="ej. Madrid, Barcelona..."
                class="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
                [class.border-red-400]="isInvalid('ciudadOrigen')"
              />
              @if (isInvalid('ciudadOrigen')) {
                <p class="text-xs text-red-500">Este campo es obligatorio</p>
              }
            </div>

            <!-- Plazas de coche -->
            <div class="space-y-1">
              <label class="block text-sm font-semibold text-gray-700">
                Plazas de coche disponibles
              </label>
              <div class="flex items-center gap-3">
                <button
                  type="button"
                  (click)="decrementPlazas()"
                  class="w-10 h-10 rounded-full bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-bold text-lg transition flex items-center justify-center"
                >−</button>
                <span class="text-2xl font-bold text-indigo-700 w-8 text-center">
                  {{ form.get('plazasCoche')?.value }}
                </span>
                <button
                  type="button"
                  (click)="incrementPlazas()"
                  class="w-10 h-10 rounded-full bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-bold text-lg transition flex items-center justify-center"
                >+</button>
                <span class="text-sm text-gray-500 ml-1">plazas libres en mi coche</span>
              </div>
            </div>

            <!-- Habla inglés -->
            <div class="space-y-1">
              <label class="block text-sm font-semibold text-gray-700">¿Habla inglés?</label>
              <label class="inline-flex items-center gap-3 cursor-pointer select-none">
                <div
                  class="relative w-12 h-6 rounded-full transition-colors duration-200"
                  [class.bg-indigo-500]="form.get('hablaIngles')?.value"
                  [class.bg-gray-300]="!form.get('hablaIngles')?.value"
                  (click)="toggleIngles()"
                >
                  <div
                    class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
                    [class.translate-x-6]="form.get('hablaIngles')?.value"
                  ></div>
                </div>
                <span class="text-sm text-gray-700">
                  {{ form.get('hablaIngles')?.value ? 'Sí, hablo inglés' : 'No' }}
                </span>
              </label>
            </div>

            <!-- Fechas y horas -->
            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-1">
                <label class="block text-sm font-semibold text-gray-700">
                  Llegada <span class="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  formControlName="fechaLlegada"
                  class="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
                  [class.border-red-400]="isInvalid('fechaLlegada')"
                />
                @if (isInvalid('fechaLlegada')) {
                  <p class="text-xs text-red-500">Obligatorio</p>
                }
                <input
                  type="time"
                  formControlName="horaLlegada"
                  class="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
                  [class.border-red-400]="isInvalid('horaLlegada')"
                />
                @if (isInvalid('horaLlegada')) {
                  <p class="text-xs text-red-500">Obligatorio</p>
                }
              </div>
              <div class="space-y-1">
                <label class="block text-sm font-semibold text-gray-700">
                  Salida <span class="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  formControlName="fechaSalida"
                  class="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
                  [class.border-red-400]="isInvalid('fechaSalida')"
                />
                @if (isInvalid('fechaSalida')) {
                  <p class="text-xs text-red-500">Obligatorio</p>
                }
                <input
                  type="time"
                  formControlName="horaSalida"
                  class="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
                  [class.border-red-400]="isInvalid('horaSalida')"
                />
                @if (isInvalid('horaSalida')) {
                  <p class="text-xs text-red-500">Obligatorio</p>
                }
              </div>
            </div>

            <!-- Dirección hospedaje -->
            <div class="space-y-1">
              <label class="block text-sm font-semibold text-gray-700">
                Dirección del hospedaje <span class="text-red-500">*</span>
              </label>
              <app-location-picker
                [required]="true"
                (locationSelected)="onLocationSelected($event)"
              />
            </div>

            <!-- Feedback -->
            @if (submitError()) {
              <div class="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                ❌ {{ submitError() }}
              </div>
            }
            @if (submitSuccess()) {
              <div class="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700">
                ✅ ¡Datos guardados correctamente! Gracias por apuntarte.
              </div>
            }

            <button
              type="submit"
              [disabled]="sheetsService.isLoading()"
              class="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm"
            >
              @if (sheetsService.isLoading()) {
                <span class="inline-flex items-center gap-2 justify-center">
                  <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Guardando...
                </span>
              } @else {
                Enviar formulario
              }
            </button>

          </form>
        }

      </div>
    </div>
  `,
})
export class GuestFormComponent {
  readonly step = signal<Step>('code');
  readonly isValidating = signal(false);
  readonly codeError = signal<string | null>(null);
  readonly submitError = signal<string | null>(null);
  readonly submitSuccess = signal(false);
  private guestRow = 0;

  codeControl!: FormControl<string | null>;
  form!: FormGroup;

  constructor(
    private fb: FormBuilder,
    public sheetsService: GoogleSheetsService,
  ) {
    this.codeControl = fb.control('', Validators.required);
    this.form = fb.group({
      nombreCompleto:     ['', Validators.required],
      ciudadOrigen:       ['', Validators.required],
      plazasCoche:        [0],
      hablaIngles:        [false],
      fechaLlegada:       ['', Validators.required],
      horaLlegada:        ['', Validators.required],
      fechaSalida:        ['', Validators.required],
      horaSalida:         ['', Validators.required],
      direccionHospedaje: ['', Validators.required],
      latitud:            [null as number | null],
      longitud:           [null as number | null],
    });
  }

  async validateCode(): Promise<void> {
    const codigo = this.codeControl.value?.trim();
    if (!codigo) return;

    this.isValidating.set(true);
    this.codeError.set(null);

    try {
      const fila = await this.sheetsService.validateCode(codigo);
      if (fila !== null) {
        this.guestRow = fila;
        this.step.set('form');
      } else {
        this.codeError.set('Código no encontrado. Revisa que sea correcto.');
      }
    } catch {
      this.codeError.set('No se pudo verificar el código. Inténtalo de nuevo.');
    } finally {
      this.isValidating.set(false);
    }
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

  toggleIngles(): void {
    const v = this.form.get('hablaIngles')?.value;
    this.form.get('hablaIngles')?.setValue(!v);
  }

  onLocationSelected(place: PlaceResult | null): void {
    this.form.patchValue({
      direccionHospedaje: place?.address ?? '',
      latitud:  place?.lat ?? null,
      longitud: place?.lng ?? null,
    });
  }

  async onSubmit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.submitError.set(null);
    this.submitSuccess.set(false);

    try {
      const data: GuestFormData = {
        codigoInvitado: this.codeControl.value!,
        fila: this.guestRow,
        ...this.form.getRawValue() as Omit<GuestFormData, 'codigoInvitado' | 'fila'>,
      };
      await this.sheetsService.saveRow(data);
      this.submitSuccess.set(true);
      this.form.reset({ plazasCoche: 0, hablaIngles: false, horaLlegada: '', horaSalida: '' });
    } catch (err: any) {
      this.submitError.set(err.message ?? 'Error desconocido al enviar');
    }
  }
}
