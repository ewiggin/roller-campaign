import { Component, signal } from "@angular/core";
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import {
  ExistingFormData,
  GoogleSheetsService,
  VolunteerFormData,
} from "../../services/google-sheets.service";
import {
  LocationPickerComponent,
  PlaceResult,
} from "../location-picker/location-picker.component";

type Step = "code" | "form" | "success";

const DIAS = [
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "domingo",
] as const;
const DIAS_LABEL: Record<(typeof DIAS)[number], string> = {
  lunes: "Lunes",
  martes: "Martes",
  miercoles: "Miércoles",
  jueves: "Jueves",
  viernes: "Viernes",
  sabado: "Sábado",
  domingo: "Domingo",
};

@Component({
  selector: "app-volunteer-form",
  standalone: true,
  imports: [ReactiveFormsModule, LocationPickerComponent],
  templateUrl: "./volunteer-form.component.html",
})
export class VolunteerFormComponent {
  readonly step = signal<Step>("code");
  readonly isValidating = signal(false);
  readonly codeError = signal<string | null>(null);
  readonly submitError = signal<string | null>(null);
  readonly volunteerName = signal("");
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
    this.codeControl = fb.control("", Validators.required);
    this.turnosGroup = fb.group({
      lunesManana: [false],
      lunesTarde: [false],
      martesManana: [false],
      martesTarde: [false],
      miercolesManana: [false],
      miercolesTarde: [false],
      juevesManana: [false],
      juevesTarde: [false],
      viernesManana: [false],
      viernesTarde: [false],
      sabadoManana: [false],
      sabadoTarde: [false],
      domingoManana: [false],
      domingoTarde: [false],
    });
    this.form = fb.group({
      plazasCoche: [0],
      turnos: this.turnosGroup,
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
        this.step.set("form");
      } else {
        this.codeError.set("Código no encontrado. Revisa que sea correcto.");
      }
    } catch {
      this.codeError.set("No se pudo verificar el código. Inténtalo de nuevo.");
    } finally {
      this.isValidating.set(false);
    }
  }

  private applyExistingData(data: ExistingFormData | null): void {
    if (!data) return;

    this.form.patchValue({ plazasCoche: data.plazasCoche });
    this.turnosGroup.patchValue({
      lunesManana: data.lunesManana,
      lunesTarde: data.lunesTarde,
      martesManana: data.martesManana,
      martesTarde: data.martesTarde,
      miercolesManana: data.miercolesManana,
      miercolesTarde: data.miercolesTarde,
      juevesManana: data.juevesManana,
      juevesTarde: data.juevesTarde,
      viernesManana: data.viernesManana,
      viernesTarde: data.viernesTarde,
      sabadoManana: data.sabadoManana,
      sabadoTarde: data.sabadoTarde,
      domingoManana: data.domingoManana,
      domingoTarde: data.domingoTarde,
    });

    if (data.direccion && data.lat && data.lon) {
      const location: PlaceResult = {
        address: data.direccion,
        lat: data.lat,
        lng: data.lon,
      };
      this.initialLocation.set(location);
      this.selectedLocation.set(location);
    }
  }

  incrementPlazas(): void {
    const v = this.form.get("plazasCoche")?.value ?? 0;
    if (v < 8) this.form.get("plazasCoche")?.setValue(v + 1);
  }

  decrementPlazas(): void {
    const v = this.form.get("plazasCoche")?.value ?? 0;
    if (v > 0) this.form.get("plazasCoche")?.setValue(v - 1);
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
        fila: this.volunteerRow,
        direccion: this.selectedLocation()!.address,
        mapsLink: `https://www.google.com/maps?q=${this.selectedLocation()!.lat},${this.selectedLocation()!.lng}`,
        lat: this.selectedLocation()!.lat,
        lon: this.selectedLocation()!.lng,
        plazasCoche: this.form.get("plazasCoche")!.value,
        ...turnos,
      };
      await this.sheetsService.saveRow(data);
      this.step.set("success");
    } catch (err: any) {
      this.submitError.set(err.message ?? "Error desconocido al enviar");
    }
  }
}
