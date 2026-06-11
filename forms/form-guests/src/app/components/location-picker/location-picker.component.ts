import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  ViewChild,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { environment } from '../../../environments/environment';

export interface PlaceResult {
  address: string;
  lat: number;
  lng: number;
}

@Component({
  selector: 'app-location-picker',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="space-y-2">

      <!-- Input con autocomplete -->
      <div class="relative">
        <input
          #addressInput
          type="text"
          [(ngModel)]="addressValue"
          (focus)="initAutocomplete()"
          placeholder="Calle, número, ciudad..."
          class="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition pr-10"
          [class.border-red-400]="required && !result()"
          autocomplete="off"
        />
        @if (result()) {
          <span class="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 text-base">✓</span>
        }
      </div>

      @if (required && !result() && touched()) {
        <p class="text-xs text-red-500">Este campo es obligatorio</p>
      }

      <!-- Mapa -->
      @if (result()) {
        <div class="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
          <div #mapContainer class="h-52 w-full"></div>
          <p class="text-xs text-gray-500 px-3 py-1.5 bg-gray-50">
            📍 {{ result()!.lat.toFixed(5) }}, {{ result()!.lng.toFixed(5) }} ·
            <button type="button" (click)="clearResult()" class="text-indigo-500 hover:underline">
              Cambiar dirección
            </button>
          </p>
        </div>
      }

      @if (mapError()) {
        <p class="text-xs text-red-500">{{ mapError() }}</p>
      }
    </div>
  `,
})
export class LocationPickerComponent implements OnDestroy {
  @ViewChild('addressInput') addressInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('mapContainer') mapContainerRef!: ElementRef;
  @Output() locationSelected = new EventEmitter<PlaceResult | null>();
  @Input() required = false;
  @Input() initialLat = 40.416775;
  @Input() initialLng = -3.70379;

  readonly result   = signal<PlaceResult | null>(null);
  readonly mapError = signal<string | null>(null);
  readonly touched  = signal(false);

  addressValue = '';

  private autocomplete: google.maps.places.Autocomplete | null = null;
  private map: google.maps.Map | null = null;
  private marker: google.maps.Marker | null = null;
  private initialized = false;

  async initAutocomplete(): Promise<void> {
    this.touched.set(true);
    if (this.initialized) return;
    this.initialized = true;

    try {
      setOptions({ key: environment.googleMapsApiKey, v: 'weekly' });
      const { Autocomplete } = await importLibrary('places') as google.maps.PlacesLibrary;

      this.autocomplete = new Autocomplete(this.addressInputRef.nativeElement, {
        fields: ['formatted_address', 'geometry'],
      });

      this.autocomplete.addListener('place_changed', () => {
        const place = this.autocomplete!.getPlace();
        if (!place.geometry?.location) return;

        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const address = place.formatted_address ?? this.addressValue;

        this.addressValue = address;
        const res: PlaceResult = { address, lat, lng };
        this.result.set(res);
        this.locationSelected.emit(res);

        setTimeout(() => this.renderMap(lat, lng), 50);
      });
    } catch {
      this.mapError.set('No se pudo cargar Google Places. Verifica la clave de API.');
    }
  }

  private async renderMap(lat: number, lng: number): Promise<void> {
    if (!this.mapContainerRef?.nativeElement) return;
    try {
      const { Map } = await importLibrary('maps') as google.maps.MapsLibrary;
      const pos = { lat, lng };

      if (!this.map) {
        this.map = new Map(this.mapContainerRef.nativeElement, {
          center: pos, zoom: 15,
          mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
        });
        this.marker = new google.maps.Marker({ position: pos, map: this.map });
      } else {
        this.map.setCenter(pos);
        this.marker?.setPosition(pos);
      }
    } catch { /* mapa no crítico */ }
  }

  clearResult(): void {
    this.addressValue = '';
    this.result.set(null);
    this.locationSelected.emit(null);
    this.map = null;
    this.marker = null;
    this.initialized = false;
    this.autocomplete = null;
    setTimeout(() => this.addressInputRef?.nativeElement.focus(), 50);
  }

  ngOnDestroy(): void {
    if (this.marker) this.marker.setMap(null);
  }
}
