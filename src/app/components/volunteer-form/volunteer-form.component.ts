import { Component, signal } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { VolunteerFormData, GoogleSheetsService, ExistingFormData } from '../../services/google-sheets.service';
import { LocationPickerComponent, PlaceResult } from '../location-picker/location-picker.component';

type Step = 'code' | 'form' | 'success';

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const;
const DIAS_LABEL: Record<typeof DIAS[number], string> = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
  domingo: 'Domingo',
};

@Component({
  selector: 'app-volunteer-form',
  standalone: true,
  imports: [ReactiveFormsModule, LocationPickerComponent],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div class="max-w-lg mx-auto">

        <!-- Header -->
        <div class="text-center mb-8">
          <div class="text-5xl mb-3">🛒🏖️</div>
          <h1 class="text-3xl font-bold text-indigo-800">Los carritos se van de vacaciones</h1>
          <p class="text-gray-600 mt-2">Formulario de disponibilidad de voluntarios</p>
        </div>

        <!-- PASO 1: Código de voluntario -->
        @if (step() === 'code') {
          <div class="bg-white rounded-2xl shadow-lg p-6 space-y-4">
            <div class="space-y-1">
              <label class="block text-sm font-semibold text-gray-700">
                Código de voluntario Builder Assistant<span class="text-red-500">*</span>
              </label>
              <p class="text-xs text-gray-500">Introduce tu número de identificación de voluntario</p>
              <input
                type="text"
                [formControl]="codeControl"
                (keydown.enter)="validateCode()"
                placeholder="Ej. 1234567"
                class="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
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
          @if (initialLocation()) {
            <div class="mb-4 text-center text-sm text-indigo-600 font-medium">
              Ya tienes datos registrados. Puedes modificarlos y volver a enviar.
            </div>
          }
          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="bg-white rounded-2xl shadow-lg p-6 space-y-5">

            <!-- Código confirmado + nombre -->
            <div class="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2">
              <span class="text-indigo-500">👤</span>
              <div class="flex flex-col">
                <span class="text-sm text-indigo-800 font-medium">{{ volunteerName() }}</span>
                <span class="text-xs text-indigo-500">Código: {{ codeControl.value }}</span>
              </div>
              <button
                type="button"
                (click)="step.set('code')"
                class="ml-auto text-xs text-indigo-500 hover:text-indigo-700 underline"
              >Cambiar</button>
            </div>

            <!-- Dirección -->
            <div class="space-y-1">
              <label class="block text-sm font-semibold text-gray-700">
                Dirección <span class="text-red-500">*</span>
              </label>
              <p class="text-xs text-gray-500">Indica tu dirección para facilitar la coordinación</p>
              <app-location-picker
                [required]="true"
                [initialValue]="initialLocation()"
                (locationSelected)="onLocationSelected($event)"
              />
              @if (locationTouched() && !selectedLocation()) {
                <p class="text-xs text-red-500">Este campo es obligatorio</p>
              }
            </div>

            <!-- Plazas de coche -->
            <div class="space-y-1">
              <label class="block text-sm font-semibold text-gray-700">
                Plazas disponibles en tu coche
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

            <!-- Disponibilidad de turnos -->
            <div class="space-y-2">
              <label class="block text-sm font-semibold text-gray-700">
                Disponibilidad de turnos
              </label>
              <p class="text-xs text-gray-500">Marca los turnos en los que puedes participar</p>

              <div class="overflow-x-auto rounded-xl border border-gray-200">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="bg-indigo-50">
                      <th class="text-left px-3 py-2 text-xs font-semibold text-indigo-700 w-28">Día</th>
                      <th class="text-center px-3 py-2 text-xs font-semibold text-indigo-700">🌅 Mañana</th>
                      <th class="text-center px-3 py-2 text-xs font-semibold text-indigo-700">🌇 Tarde</th>
                    </tr>
                  </thead>
                  <tbody [formGroup]="turnosGroup">
                    @for (dia of dias; track dia) {
                      <tr class="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                        <td class="px-3 py-2.5 font-medium text-gray-700 text-xs">{{ diasLabel[dia] }}</td>
                        <td class="text-center px-3 py-2.5">
                          <input
                            type="checkbox"
                            [formControlName]="dia + 'Manana'"
                            class="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                          />
                        </td>
                        <td class="text-center px-3 py-2.5">
                          <input
                            type="checkbox"
                            [formControlName]="dia + 'Tarde'"
                            class="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                          />
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Error -->
            @if (submitError()) {
              <div class="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                ❌ {{ submitError() }}
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
                Enviar disponibilidad
              }
            </button>

          </form>
        }

        <!-- CONFIRMACIÓN -->
        @if (step() === 'success') {
          <div class="bg-white rounded-2xl shadow-lg p-8 text-center space-y-5">
            <div class="text-6xl">✅</div>
            <h2 class="text-2xl font-bold text-indigo-800">¡Gracias, {{ volunteerName() }}!</h2>
            <p class="text-gray-600">
              Tu disponibilidad ha sido registrada correctamente.
            </p>
            <p class="text-gray-500 text-sm">
              Gracias por tu colaboración y disposición para servir en los carritos.
              El equipo organizador revisará tu información y se pondrá en contacto contigo si es necesario.
            </p>
            <div class="pt-2 border-t border-gray-100 text-xs text-gray-400">
              Este formulario ya no puede ser enviado de nuevo.
            </div>
          </div>
        }

      </div>
    </div>
  `,
})
export class VolunteerFormComponent {
  readonly step = signal<Step>('code');
  readonly isValidating = signal(false);
  readonly codeError = signal<string | null>(null);
  readonly submitError = signal<string | null>(null);
  readonly volunteerName = signal('');
  readonly selectedLocation = signal<PlaceResult | null>(null);
  readonly locationTouched = signal(false);
  readonly initialLocation = signal<PlaceResult | null>(null);

  readonly dias = DIAS;
  readonly diasLabel = DIAS_LABEL;

  private volunteerRow = 0;

  codeControl!: FormControl<string | null>;
  form!: FormGroup;
  turnosGroup!: FormGroup;

  constructor(
    private fb: FormBuilder,
    public sheetsService: GoogleSheetsService,
  ) {
    this.codeControl = fb.control('', Validators.required);
    this.turnosGroup = fb.group({
      lunesManana:     [false],
      lunesTarde:      [false],
      martesManana:    [false],
      martesTarde:     [false],
      miercolesManana: [false],
      miercolesTarde:  [false],
      juevesManana:    [false],
      juevesTarde:     [false],
      viernesManana:   [false],
      viernesTarde:    [false],
      sabadoManana:    [false],
      sabadoTarde:     [false],
      domingoManana:   [false],
      domingoTarde:    [false],
    });
    this.form = fb.group({
      plazasCoche: [0],
      turnos:      this.turnosGroup,
    });
  }

  onLocationSelected(place: PlaceResult | null): void {
    this.locationTouched.set(true);
    this.selectedLocation.set(place);
  }

  async validateCode(): Promise<void> {
    const codigo = this.codeControl.value?.trim();
    if (!codigo) return;

    this.isValidating.set(true);
    this.codeError.set(null);

    try {
      const result = await this.sheetsService.validateCode(codigo);
      if (result !== null) {
        this.volunteerRow = result.fila;
        this.volunteerName.set(result.nombre);
        this.applyExistingData(result.formData);
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

  private applyExistingData(data: ExistingFormData | null): void {
    if (!data) return;

    this.form.patchValue({ plazasCoche: data.plazasCoche });
    this.turnosGroup.patchValue({
      lunesManana:     data.lunesManana,
      lunesTarde:      data.lunesTarde,
      martesManana:    data.martesManana,
      martesTarde:     data.martesTarde,
      miercolesManana: data.miercolesManana,
      miercolesTarde:  data.miercolesTarde,
      juevesManana:    data.juevesManana,
      juevesTarde:     data.juevesTarde,
      viernesManana:   data.viernesManana,
      viernesTarde:    data.viernesTarde,
      sabadoManana:    data.sabadoManana,
      sabadoTarde:     data.sabadoTarde,
      domingoManana:   data.domingoManana,
      domingoTarde:    data.domingoTarde,
    });

    if (data.direccion && data.lat && data.lon) {
      const location: PlaceResult = { address: data.direccion, lat: data.lat, lng: data.lon };
      this.initialLocation.set(location);
      this.selectedLocation.set(location);
    }
  }

  incrementPlazas(): void {
    const v = this.form.get('plazasCoche')?.value ?? 0;
    if (v < 8) this.form.get('plazasCoche')?.setValue(v + 1);
  }

  decrementPlazas(): void {
    const v = this.form.get('plazasCoche')?.value ?? 0;
    if (v > 0) this.form.get('plazasCoche')?.setValue(v - 1);
  }

  async onSubmit(): Promise<void> {
    this.form.markAllAsTouched();
    this.locationTouched.set(true);
    if (this.form.invalid || !this.selectedLocation()) return;

    this.submitError.set(null);

    try {
      const turnos = this.turnosGroup.getRawValue();
      const data: VolunteerFormData = {
        codigoVoluntario: this.codeControl.value!,
        fila:             this.volunteerRow,
        direccion:        this.selectedLocation()!.address,
        mapsLink:         `https://www.google.com/maps?q=${this.selectedLocation()!.lat},${this.selectedLocation()!.lng}`,
        lat:              this.selectedLocation()!.lat,
        lon:              this.selectedLocation()!.lng,
        plazasCoche:      this.form.get('plazasCoche')!.value,
        ...turnos,
      };
      await this.sheetsService.saveRow(data);
      this.step.set('success');
    } catch (err: any) {
      this.submitError.set(err.message ?? 'Error desconocido al enviar');
    }
  }
}
