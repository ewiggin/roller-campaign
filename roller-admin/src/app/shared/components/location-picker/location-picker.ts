import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

export interface PlaceResult {
  address: string;
  lat: number;
  lng: number;
}

interface PlacePrediction {
  place_id: string;
  description: string;
}

type PickerMode = 'preview' | 'editing';

@Component({
  selector: 'app-location-picker',
  imports: [FormsModule],
  templateUrl: './location-picker.html',
})
export class LocationPickerComponent implements OnInit, OnDestroy {
  @ViewChild('addressInput') private addressInputRef?: ElementRef<HTMLInputElement>;

  @Output() locationSelected = new EventEmitter<PlaceResult | null>();

  @Input() required = false;
  @Input() showMap = true;
  @Input() initialAddress: string | null = null;
  @Input() initialLat: number | null = null;
  @Input() initialLng: number | null = null;

  readonly result = signal<PlaceResult | null>(null);
  readonly mode = signal<PickerMode>('editing');
  readonly touched = signal(false);
  readonly suggestions = signal<PlacePrediction[]>([]);
  readonly loadingSuggestions = signal(false);
  readonly error = signal<string | null>(null);

  addressValue = '';
  latValue = '';
  lngValue = '';

  private readonly http = inject(HttpClient);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    if (this.initialAddress && this.initialLat !== null && this.initialLng !== null) {
      this.addressValue = this.initialAddress;
      this.latValue = String(this.initialLat);
      this.lngValue = String(this.initialLng);
      this.result.set({ address: this.initialAddress, lat: this.initialLat, lng: this.initialLng });
      this.mode.set('preview');
    }
  }

  // ── Static map ────────────────────────────────────────────────────────────

  staticMapUrl(): string {
    const r = this.result();
    if (!r) return '';
    const { lat, lng } = r;
    const key = environment.googleMapsApiKey;
    return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=15&size=640x240&markers=color:red%7C${lat},${lng}&key=${key}&scale=2`;
  }

  // ── Mode transitions ──────────────────────────────────────────────────────

  startEditing(): void {
    this.mode.set('editing');
    setTimeout(() => this.addressInputRef?.nativeElement.focus(), 60);
  }

  // ── Autocomplete ──────────────────────────────────────────────────────────

  onAddressInput(): void {
    this.touched.set(true);
    const value = this.addressValue.trim();

    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    if (value.length < 3) {
      this.suggestions.set([]);
      return;
    }

    this.debounceTimer = setTimeout(() => {
      this.loadingSuggestions.set(true);
      this.http
        .get<PlacePrediction[]>('/api/places/autocomplete', { params: { input: value } })
        .subscribe({
          next: (preds) => {
            this.suggestions.set(preds);
            this.loadingSuggestions.set(false);
          },
          error: () => {
            this.suggestions.set([]);
            this.loadingSuggestions.set(false);
          },
        });
    }, 300);
  }

  selectSuggestion(prediction: PlacePrediction): void {
    this.suggestions.set([]);
    this.addressValue = prediction.description;
    this.http
      .get<PlaceResult>('/api/places/details', { params: { place_id: prediction.place_id } })
      .subscribe({
        next: (details) => {
          this.addressValue = details.address;
          this.setResult(details);
        },
        error: () => {
          this.error.set('No se pudieron obtener los detalles del lugar.');
        },
      });
  }

  closeSuggestions(): void {
    // Delay to allow click on suggestion to fire before hiding
    setTimeout(() => this.suggestions.set([]), 150);
  }

  // ── Lat / Lng manual input ────────────────────────────────────────────────

  onLatLngInput(): void {
    const lat = parseFloat(this.latValue);
    const lng = parseFloat(this.lngValue);
    if (isNaN(lat) || isNaN(lng)) return;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return;
    this.touched.set(true);
    this.setResult({
      address: this.addressValue || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      lat,
      lng,
    });
  }

  // ── Clear ─────────────────────────────────────────────────────────────────

  clearResult(): void {
    this.addressValue = '';
    this.latValue = '';
    this.lngValue = '';
    this.result.set(null);
    this.suggestions.set([]);
    this.locationSelected.emit(null);
    this.mode.set('editing');
    setTimeout(() => this.addressInputRef?.nativeElement.focus(), 60);
  }

  private setResult(r: PlaceResult): void {
    this.result.set(r);
    this.latValue = String(r.lat);
    this.lngValue = String(r.lng);
    this.locationSelected.emit(r);
  }

  ngOnDestroy(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }
}
