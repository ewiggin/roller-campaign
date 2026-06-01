import { Component, inject, OnInit, signal } from "@angular/core";
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { RouterLink } from "@angular/router";
import {
  RegionOption,
  VolunteerApiService,
  VolunteerSubmitData,
} from "../../services/volunteer-api.service";
import {
  LocationPickerComponent,
  PlaceResult,
} from "../location-picker/location-picker.component";
import { TERMS_VERSION } from "../../pages/legal/legal";

type Step = "code" | "form" | "success";

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
const DAY_LABEL: Record<(typeof DAYS)[number], string> = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miércoles",
  thursday: "Jueves",
  friday: "Viernes",
  saturday: "Sábado",
  sunday: "Domingo",
};

@Component({
  selector: "app-volunteer-form",
  standalone: true,
  imports: [ReactiveFormsModule, LocationPickerComponent, RouterLink],
  templateUrl: "./volunteer-form.component.html",
})
export class VolunteerFormComponent implements OnInit {
  readonly step = signal<Step>("code");
  readonly isValidating = signal(false);
  readonly codeError = signal<string | null>(null);
  readonly submitError = signal<string | null>(null);
  readonly volunteerName = signal("");
  readonly selectedLocation = signal<PlaceResult | null>(null);
  readonly locationTouched = signal(false);
  readonly initialLocation = signal<PlaceResult | null>(null);
  readonly carAvailable = signal(false);
  readonly availableRegions = signal<RegionOption[]>([]);
  readonly regionsError = signal<string | null>(null);
  readonly termsAlreadyAccepted = signal(false);
  readonly termsAcceptedAt = signal<string | null>(null);

  readonly days = DAYS;
  readonly dayLabel = DAY_LABEL;

  private volunteerCode = "";

  protected readonly apiService = inject(VolunteerApiService);
  private readonly fb = inject(FormBuilder);

  codeControl!: FormControl<number | null>;
  form!: FormGroup;
  shiftsGroup!: FormGroup;

  constructor() {
    this.codeControl = this.fb.control<number | null>(
      null,
      Validators.required,
    );
    this.shiftsGroup = this.fb.group({
      monday_morning: [false],
      monday_afternoon: [false],
      tuesday_morning: [false],
      tuesday_afternoon: [false],
      wednesday_morning: [false],
      wednesday_afternoon: [false],
      thursday_morning: [false],
      thursday_afternoon: [false],
      friday_morning: [false],
      friday_afternoon: [false],
      saturday_morning: [false],
      saturday_afternoon: [false],
      sunday_morning: [false],
      sunday_afternoon: [false],
    });
    this.form = this.fb.group({
      email: ["", [Validators.required, Validators.email]],
      region_id: ["", Validators.required],
      carSeats: [0],
      shifts: this.shiftsGroup,
      aceptaCondiciones: [false, Validators.requiredTrue],
    });
  }

  async ngOnInit(): Promise<void> {
    try {
      const regions = await this.apiService.getRegions();
      this.availableRegions.set(regions);
    } catch {
      this.regionsError.set(
        "No se pudieron cargar las regiones. Recarga la página.",
      );
    }
  }

  onLocationSelected(place: PlaceResult | null): void {
    this.locationTouched.set(true);
    this.selectedLocation.set(place);
  }

  async validateCode(): Promise<void> {
    const code =
      this.codeControl.value != null ? String(this.codeControl.value) : null;
    if (!code) return;

    this.isValidating.set(true);
    this.codeError.set(null);

    try {
      const result = await this.apiService.lookup(code);
      if (result !== null) {
        this.volunteerCode = result.volunteer_code;
        this.volunteerName.set(result.full_name);
        this.applyExistingData(result);
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

  isInvalid(field: string): boolean {
    const control = this.form.get(field);
    return !!(control?.invalid && control?.touched);
  }

  private applyExistingData(data: {
    email: string | null;
    car_seats: number | null;
    hosting_address: string | null;
    lat: number | null;
    lng: number | null;
    maps_link: string | null;
    regions: RegionOption[];
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
    terms_accepted: boolean | null;
    terms_accepted_at: string | null;
  }): void {
    const carSeats = data.car_seats ?? 0;
    this.carAvailable.set(carSeats > 0);

    const alreadyAccepted = data.terms_accepted === true;
    this.termsAlreadyAccepted.set(alreadyAccepted);
    this.termsAcceptedAt.set(data.terms_accepted_at);

    const preselectedRegion =
      data.regions.length === 1 ? data.regions[0].id : "";

    this.form.patchValue({
      email: data.email ?? "",
      region_id: preselectedRegion,
      carSeats,
      aceptaCondiciones: alreadyAccepted,
    });

    this.shiftsGroup.patchValue({
      monday_morning: data.monday_morning,
      monday_afternoon: data.monday_afternoon,
      tuesday_morning: data.tuesday_morning,
      tuesday_afternoon: data.tuesday_afternoon,
      wednesday_morning: data.wednesday_morning,
      wednesday_afternoon: data.wednesday_afternoon,
      thursday_morning: data.thursday_morning,
      thursday_afternoon: data.thursday_afternoon,
      friday_morning: data.friday_morning,
      friday_afternoon: data.friday_afternoon,
      saturday_morning: data.saturday_morning,
      saturday_afternoon: data.saturday_afternoon,
      sunday_morning: data.sunday_morning,
      sunday_afternoon: data.sunday_afternoon,
    });

    if (data.hosting_address && data.lat && data.lng) {
      const location: PlaceResult = {
        address: data.hosting_address,
        lat: data.lat,
        lng: data.lng,
      };
      this.initialLocation.set(location);
      this.selectedLocation.set(location);
    }
  }

  formatTermsDate(isoString: string): string {
    const d = new Date(isoString);
    return d.toLocaleString("es-ES", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  incrementSeats(): void {
    const v = this.form.get("carSeats")?.value ?? 0;
    if (v < 8) this.form.get("carSeats")?.setValue(v + 1);
  }

  decrementSeats(): void {
    const v = this.form.get("carSeats")?.value ?? 0;
    if (v > 0) this.form.get("carSeats")?.setValue(v - 1);
  }

  toggleCar(): void {
    this.carAvailable.set(!this.carAvailable());
    if (!this.carAvailable()) {
      this.form.get("carSeats")?.patchValue(0);
    }
  }

  async onSubmit(): Promise<void> {
    this.form.markAllAsTouched();
    this.locationTouched.set(true);
    if (this.form.invalid || !this.selectedLocation()) return;

    this.submitError.set(null);

    try {
      const shifts = this.shiftsGroup.getRawValue();
      const loc = this.selectedLocation()!;
      const data: VolunteerSubmitData = {
        email: this.form.get("email")!.value,
        region_id: this.form.get("region_id")!.value,
        hosting_address: loc.address,
        lat: loc.lat,
        lng: loc.lng,
        maps_link: `https://www.google.com/maps?q=${loc.lat},${loc.lng}`,
        car_seats: this.form.get("carSeats")!.value,
        ...shifts,
        terms_accepted: this.form.get("aceptaCondiciones")!.value,
        terms_version: TERMS_VERSION,
      };
      await this.apiService.submit(this.volunteerCode, data);
      this.step.set("success");
    } catch (err: unknown) {
      this.submitError.set(
        err instanceof Error ? err.message : "Error desconocido al enviar",
      );
    }
  }
}
