import { Component, signal } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { GoogleSheetsService, GuestFormData } from '../../services/google-sheets.service';
import { LocationPickerComponent, PlaceResult } from '../location-picker/location-picker.component';

type Step = 'code' | 'form';

@Component({
  selector: 'app-guest-form',
  standalone: true,
  imports: [ReactiveFormsModule, LocationPickerComponent],
  templateUrl: './guest-form.component.html',
})
export class GuestFormComponent {
  readonly step = signal<Step>('code');
  readonly isValidating = signal(false);
  readonly codeError = signal<string | null>(null);
  readonly submitError = signal<string | null>(null);
  readonly submitSuccess = signal(false);
  readonly carAvailable = signal(false);
  private guestRow = 0;

  codeControl!: FormControl<string | null>;
  form!: FormGroup;

  constructor(
    private fb: FormBuilder,
    public sheetsService: GoogleSheetsService,
  ) {
    this.codeControl = fb.control('', Validators.required);
    this.form = fb.group({
      nombreCompleto: ['', Validators.required],
      ciudadOrigen: ['', Validators.required],
      plazasCoche: [0],
      hablaIngles: [false],
      fechaLlegada: ['', Validators.required],
      horaLlegada: ['', Validators.required],
      fechaSalida: ['', Validators.required],
      horaSalida: ['', Validators.required],
      direccionHospedaje: ['', Validators.required],
      latitud: [null as number | null],
      longitud: [null as number | null],
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
      latitud: place?.lat ?? null,
      longitud: place?.lng ?? null,
    });
  }

  toggleCar() {
    this.carAvailable.set(!this.carAvailable());
    if (!this.carAvailable()) {
      this.form.get('plazasCoche')?.patchValue(0);
    }
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
        ...(this.form.getRawValue() as Omit<GuestFormData, 'codigoInvitado' | 'fila'>),
      };
      await this.sheetsService.saveRow(data);
      this.submitSuccess.set(true);
      this.form.reset({ plazasCoche: 0, hablaIngles: false, horaLlegada: '', horaSalida: '' });
    } catch (err: any) {
      this.submitError.set(err.message ?? 'Error desconocido al enviar');
    }
  }
}
