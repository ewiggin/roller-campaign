import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { environment } from '../../../../environments/environment';

export interface PlaceResult {
  address: string;
  lat: number;
  lng: number;
}

type PickerMode = 'preview' | 'editing';

@Component({
  selector: 'app-location-picker',
  imports: [FormsModule],
  templateUrl: './location-picker.html',
})
export class LocationPickerComponent implements OnInit, OnDestroy {
  @ViewChild('addressInput') private addressInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('mapContainer') private mapContainerRef?: ElementRef<HTMLDivElement>;

  @Output() locationSelected = new EventEmitter<PlaceResult | null>();

  @Input() required = false;
  @Input() showMap = true;
  @Input() initialAddress: string | null = null;
  @Input() initialLat: number | null = null;
  @Input() initialLng: number | null = null;

  readonly result = signal<PlaceResult | null>(null);
  readonly mode = signal<PickerMode>('editing');
  readonly mapError = signal<string | null>(null);
  readonly touched = signal(false);

  addressValue = '';

  private autocomplete: google.maps.places.Autocomplete | null = null;
  private map: google.maps.Map | null = null;
  private marker: google.maps.Marker | null = null;
  private geocoder: google.maps.Geocoder | null = null;
  private autocompleteReady = false;
  private mapReady = false;

  ngOnInit(): void {
    setOptions({ key: environment.googleMapsApiKey, v: 'weekly' });
    if (this.initialAddress && this.initialLat !== null && this.initialLng !== null) {
      this.addressValue = this.initialAddress;
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
    setTimeout(() => {
      this.addressInputRef?.nativeElement.focus();
      if (this.result()) this.initInteractiveMap();
    }, 60);
  }

  // ── Autocomplete ──────────────────────────────────────────────────────────

  async initAutocomplete(): Promise<void> {
    this.touched.set(true);
    if (this.autocompleteReady || !this.addressInputRef) return;
    this.autocompleteReady = true;

    try {
      const { Autocomplete } = (await importLibrary('places')) as google.maps.PlacesLibrary;

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
        this.setResult({ address, lat, lng });
        setTimeout(() => this.updateMapPosition(lat, lng), 60);
      });
    } catch {
      this.mapError.set('Could not load Google Places. Check the API key.');
    }
  }

  // ── Interactive map ───────────────────────────────────────────────────────

  private async initInteractiveMap(): Promise<void> {
    if (this.mapReady || !this.mapContainerRef?.nativeElement || !this.result()) return;
    this.mapReady = true;

    try {
      const { Map } = (await importLibrary('maps')) as google.maps.MapsLibrary;
      const r = this.result()!;
      const pos = { lat: r.lat, lng: r.lng };

      this.map = new Map(this.mapContainerRef.nativeElement, {
        center: pos,
        zoom: 15,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });

      this.marker = new google.maps.Marker({
        position: pos,
        map: this.map,
        draggable: true,
        cursor: 'move',
        title: 'Drag to adjust position',
      });

      this.geocoder = new google.maps.Geocoder();

      this.marker.addListener('dragend', () => {
        const newPos = this.marker!.getPosition();
        if (!newPos) return;
        this.reverseGeocode(newPos.lat(), newPos.lng());
      });
    } catch {
      this.mapError.set('Could not load interactive map.');
    }
  }

  private updateMapPosition(lat: number, lng: number): void {
    if (!this.mapReady) {
      this.initInteractiveMap();
      return;
    }
    const pos = { lat, lng };
    this.map?.panTo(pos);
    this.marker?.setPosition(pos);
  }

  private reverseGeocode(lat: number, lng: number): void {
    const fallback = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    if (!this.geocoder) {
      this.setResult({ address: fallback, lat, lng });
      return;
    }
    this.geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      const address = status === 'OK' && results?.[0] ? results[0].formatted_address : fallback;
      this.addressValue = address;
      this.setResult({ address, lat, lng });
    });
  }

  // ── Clear ─────────────────────────────────────────────────────────────────

  clearResult(): void {
    this.addressValue = '';
    this.result.set(null);
    this.locationSelected.emit(null);
    this.map = null;
    this.marker = null;
    this.mapReady = false;
    this.autocompleteReady = false;
    this.autocomplete = null;
    this.geocoder = null;
    this.mode.set('editing');
    setTimeout(() => this.addressInputRef?.nativeElement.focus(), 60);
  }

  private setResult(r: PlaceResult): void {
    this.result.set(r);
    this.locationSelected.emit(r);
  }

  ngOnDestroy(): void {
    if (this.marker) this.marker.setMap(null);
  }
}
