import {
  Component,
  ElementRef,
  ViewChild,
  inject,
  signal,
  computed,
  effect,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import {
  LocationPickerComponent,
  type PlaceResult,
} from '../../../shared/components/location-picker/location-picker';
import { SearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select';
import {
  MenuButtonComponent,
  type MenuItem,
} from '../../../shared/components/menu-button/menu-button';
import { CartsService } from '../../../core/services/carts.service';
import { RegionsService } from '../../../core/services/regions.service';
import { HostsService } from '../../../core/services/hosts.service';
import { StorageService } from '../../../core/services/storage.service';
import { downloadFile } from '../../../core/utils/download-file';
import type {
  Cart,
  ImportCartParseResponse,
  ImportCartCommitResponse,
} from '../../../core/models/cart.model';
import type { Region } from '../../../core/models/region.model';
import type { Host } from '../../../core/models/host.model';
import { environment } from '../../../../environments/environment';

type ModalMode = 'create' | 'edit' | null;

@Component({
  selector: 'app-carts-list',
  imports: [
    ReactiveFormsModule,
    LocationPickerComponent,
    SearchableSelectComponent,
    MenuButtonComponent,
  ],
  templateUrl: './carts-list.html',
})
export class CartsListComponent implements OnInit, OnDestroy {
  @ViewChild('imageInput') private imageInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('mapContainer') private mapContainerRef?: ElementRef<HTMLDivElement>;

  private readonly svc = inject(CartsService);
  private readonly regionsSvc = inject(RegionsService);
  private readonly hostsSvc = inject(HostsService);
  private readonly storageSvc = inject(StorageService);
  private readonly fb = inject(FormBuilder);

  readonly excelMenuItems = computed<MenuItem[]>(() => [
    { label: 'Export Excel', action: () => this.downloadExcel() },
    { label: 'Template', action: () => this.downloadTemplate() },
    { label: 'Import Excel', action: () => this.openImport() },
  ]);

  readonly carts = signal<Cart[]>([]);
  readonly regions = signal<Region[]>([]);
  readonly hosts = signal<Host[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  readonly modal = signal<ModalMode>(null);
  readonly saving = signal(false);
  readonly formError = signal('');
  private editingId = signal<string | null>(null);

  // LocationPicker initial values (plain properties, set before modal opens)
  primaryLocationInput: { address: string; lat: number; lng: number } | null = null;
  secondaryLocationInput: { address: string; lat: number; lng: number } | null = null;

  readonly primaryLocation = signal<PlaceResult | null>(null);
  readonly secondaryLocation = signal<PlaceResult | null>(null);
  readonly hasSecondary = signal(false);

  readonly imageKey = signal<string | null>(null);
  readonly existingImageUrl = signal<string | null>(null);
  readonly imageFile = signal<File | null>(null);
  readonly imagePreviewObjectUrl = signal<string | null>(null);
  readonly uploading = signal(false);
  readonly uploadPercent = signal(0);

  readonly form = this.fb.nonNullable.group({
    region_id: ['', Validators.required],
    host_id: [null as string | null],
    number: [''],
  });

  private readonly selectedRegionId = signal('');

  readonly regionItems = computed(() =>
    this.regions().map((r) => ({ value: r.id, label: r.name })),
  );

  readonly hostItems = computed(() => {
    const rid = this.selectedRegionId();
    return this.hosts()
      .filter((h) => !rid || h.region_id === rid)
      .map((h) => ({ value: h.id, label: h.name }));
  });

  // ── Filters ─────────────────────────────────────────────────────────────────
  readonly filterRegion = signal('');
  readonly filterHost = signal('');
  readonly filterNumber = signal('');

  readonly filterHostItems = computed(() => {
    const rid = this.filterRegion();
    return this.hosts()
      .filter((h) => !rid || h.region_id === rid)
      .map((h) => ({ value: h.id, label: h.name }));
  });

  readonly hasActiveFilters = computed(
    () => !!this.filterRegion() || !!this.filterHost() || !!this.filterNumber(),
  );

  readonly filteredCarts = computed(() => {
    const regionId = this.filterRegion();
    const hostId = this.filterHost();
    const number = this.filterNumber().trim().toLowerCase();
    return this.carts().filter((c) => {
      if (regionId && c.region_id !== regionId) return false;
      if (hostId && c.host_id !== hostId) return false;
      if (number && !c.number.toLowerCase().includes(number)) return false;
      return true;
    });
  });

  onRegionFilterChange(regionId: string) {
    this.filterRegion.set(regionId);
    this.filterHost.set('');
  }

  clearFilters() {
    this.filterRegion.set('');
    this.filterHost.set('');
    this.filterNumber.set('');
  }

  // ── Map ─────────────────────────────────────────────────────────────────────
  readonly mapExpanded = signal(false);
  readonly mapError = signal<string | null>(null);
  private map: google.maps.Map | null = null;
  private mapMarkers: google.maps.Marker[] = [];

  toggleMap() {
    const next = !this.mapExpanded();
    this.mapExpanded.set(next);
    if (next) {
      this.map = null;
      this.mapError.set(null);
      setTimeout(() => this.initMap(), 60);
    }
  }

  private async initMap(): Promise<void> {
    if (!this.mapContainerRef?.nativeElement) return;
    setOptions({ key: environment.googleMapsApiKey, v: 'weekly' });
    try {
      const { Map } = (await importLibrary('maps')) as google.maps.MapsLibrary;
      this.map = new Map(this.mapContainerRef.nativeElement, {
        center: { lat: 0, lng: 0 },
        zoom: 2,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      this.renderMarkers(this.filteredCarts());
    } catch {
      this.mapError.set('Could not load map. Check the API key.');
    }
  }

  private renderMarkers(carts: Cart[]): void {
    if (!this.map) return;
    this.mapMarkers.forEach((m) => m.setMap(null));
    this.mapMarkers = [];

    const bounds = new google.maps.LatLngBounds();
    let hasPoints = false;

    for (const cart of carts) {
      for (const loc of [cart.primary_location, cart.secondary_location]) {
        if (!loc) continue;
        const position = { lat: loc.lat, lng: loc.lng };
        const marker = new google.maps.Marker({
          position,
          map: this.map,
          title: cart.number ? `Cart ${cart.number}` : 'Cart',
        });
        this.mapMarkers.push(marker);
        bounds.extend(position);
        hasPoints = true;
      }
    }

    if (hasPoints) this.map.fitBounds(bounds);
  }

  // ── Import ──────────────────────────────────────────────────────────────────
  readonly importModal = signal(false);
  readonly importStep = signal<'upload' | 'preview' | 'done'>('upload');
  readonly importing = signal(false);
  readonly importError = signal('');
  readonly parseResult = signal<ImportCartParseResponse | null>(null);
  readonly commitResult = signal<ImportCartCommitResponse | null>(null);
  isDragging = false;

  constructor() {
    effect(() => {
      const carts = this.filteredCarts();
      if (this.mapExpanded() && this.map) this.renderMarkers(carts);
    });
  }

  ngOnDestroy() {
    this.mapMarkers.forEach((m) => m.setMap(null));
  }

  ngOnInit() {
    this.regionsSvc.getAll().subscribe({ next: (r) => this.regions.set(r) });
    this.hostsSvc.getAll().subscribe({ next: (h) => this.hosts.set(h) });
    this.form.get('region_id')!.valueChanges.subscribe((rid) => {
      this.selectedRegionId.set(rid ?? '');
      this.form.patchValue({ host_id: null }, { emitEvent: false });
    });
    this.load();
  }

  private load() {
    this.loading.set(true);
    this.svc.getAll().subscribe({
      next: (carts) => {
        this.carts.set(carts);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Error loading carts.');
        this.loading.set(false);
      },
    });
  }

  regionNameFor(id: string): string {
    return this.regions().find((r) => r.id === id)?.name ?? id;
  }

  openCreate() {
    this.editingId.set(null);
    this.form.reset({ region_id: '', host_id: null, number: '' });
    this.selectedRegionId.set('');
    this.primaryLocationInput = null;
    this.secondaryLocationInput = null;
    this.primaryLocation.set(null);
    this.secondaryLocation.set(null);
    this.hasSecondary.set(false);
    this.imageKey.set(null);
    this.existingImageUrl.set(null);
    this.clearImageFile();
    this.formError.set('');
    this.modal.set('create');
  }

  openEdit(cart: Cart) {
    this.editingId.set(cart.id);
    this.form.reset({ region_id: cart.region_id, host_id: cart.host_id, number: cart.number });
    this.selectedRegionId.set(cart.region_id);

    if (cart.primary_location) {
      this.primaryLocationInput = { ...cart.primary_location };
      this.primaryLocation.set({ ...cart.primary_location });
    } else {
      this.primaryLocationInput = null;
      this.primaryLocation.set(null);
    }

    if (cart.secondary_location) {
      this.secondaryLocationInput = { ...cart.secondary_location };
      this.secondaryLocation.set({ ...cart.secondary_location });
      this.hasSecondary.set(true);
    } else {
      this.secondaryLocationInput = null;
      this.secondaryLocation.set(null);
      this.hasSecondary.set(false);
    }

    this.imageKey.set(cart.image_key);
    this.existingImageUrl.set(null);
    this.clearImageFile();
    this.formError.set('');

    if (cart.image_key) {
      this.storageSvc.getDownloadPresignedUrl(cart.image_key).subscribe({
        next: ({ url }) => this.existingImageUrl.set(url),
      });
    }

    this.modal.set('edit');
  }

  closeModal() {
    this.modal.set(null);
    this.clearImageFile();
  }

  onPrimaryLocation(result: PlaceResult | null) {
    this.primaryLocation.set(result);
  }

  onSecondaryLocation(result: PlaceResult | null) {
    this.secondaryLocation.set(result);
  }

  toggleSecondary() {
    if (this.hasSecondary()) {
      this.hasSecondary.set(false);
      this.secondaryLocation.set(null);
      this.secondaryLocationInput = null;
    } else {
      this.hasSecondary.set(true);
    }
  }

  triggerImageInput() {
    this.imageInputRef?.nativeElement.click();
  }

  onImageSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.formError.set('Only image files are allowed.');
      return;
    }
    this.clearImageFile();
    this.imageFile.set(file);
    this.imagePreviewObjectUrl.set(URL.createObjectURL(file));
    this.existingImageUrl.set(null);
  }

  removeImage() {
    this.clearImageFile();
    this.imageKey.set(null);
    this.existingImageUrl.set(null);
  }

  private clearImageFile() {
    const url = this.imagePreviewObjectUrl();
    if (url) URL.revokeObjectURL(url);
    this.imageFile.set(null);
    this.imagePreviewObjectUrl.set(null);
  }

  save() {
    if (this.form.invalid) return;
    this.formError.set('');
    const file = this.imageFile();
    if (file) {
      this.uploading.set(true);
      this.uploadPercent.set(0);
      const key = this.storageSvc.buildKey('carts/images', file.name);
      this.storageSvc.uploadFile(key, file).subscribe({
        next: ({ key: k, progress }) => {
          this.uploadPercent.set(progress.percent);
          if (progress.percent === 100) {
            this.imageKey.set(k);
            this.uploading.set(false);
            this.doSave();
          }
        },
        error: () => {
          this.uploading.set(false);
          this.formError.set('Image upload failed.');
        },
      });
    } else {
      this.doSave();
    }
  }

  private doSave() {
    const { region_id, host_id, number } = this.form.getRawValue();
    const primary = this.primaryLocation();
    const secondary = this.hasSecondary() ? this.secondaryLocation() : null;
    const key = this.imageKey();

    const dto = {
      region_id,
      host_id: host_id ?? null,
      number,
      primary_location: primary
        ? { address: primary.address, lat: primary.lat, lng: primary.lng }
        : null,
      secondary_location: secondary
        ? { address: secondary.address, lat: secondary.lat, lng: secondary.lng }
        : null,
      image_key: key,
    };

    const id = this.editingId();
    this.saving.set(true);

    const obs = id ? this.svc.update(id, dto) : this.svc.create(dto);
    obs.subscribe({
      next: (cart) => {
        if (id) {
          this.carts.update((list) => list.map((c) => (c.id === id ? cart : c)));
        } else {
          this.carts.update((list) => [...list, cart]);
        }
        this.saving.set(false);
        this.closeModal();
      },
      error: () => {
        this.saving.set(false);
        this.formError.set('Error saving cart.');
      },
    });
  }

  confirmDelete(cart: Cart) {
    if (!confirm(`Delete cart #${cart.number || cart.id.slice(0, 8)}?`)) return;
    this.svc.remove(cart.id).subscribe({
      next: () => this.carts.update((list) => list.filter((c) => c.id !== cart.id)),
    });
  }

  // ── Import/Export ───────────────────────────────────────────────────────────

  downloadExcel() {
    this.svc.exportExcel().subscribe((blob) => {
      void downloadFile(blob, 'carts.xlsx');
    });
  }

  downloadTemplate() {
    this.svc.downloadTemplate().subscribe((blob) => {
      void downloadFile(blob, 'template-carts.xlsx');
    });
  }

  openImport() {
    this.importStep.set('upload');
    this.importError.set('');
    this.parseResult.set(null);
    this.commitResult.set(null);
    this.importModal.set(true);
  }

  closeImport() {
    this.importModal.set(false);
    if (this.importStep() === 'done') this.load();
  }

  onDragOver(ev: DragEvent) {
    ev.preventDefault();
    this.isDragging = true;
  }

  onDragLeave() {
    this.isDragging = false;
  }

  onDrop(ev: DragEvent) {
    ev.preventDefault();
    this.isDragging = false;
    const file = ev.dataTransfer?.files[0];
    if (file) this.parseFile(file);
  }

  onImportFileSelected(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (file) this.parseFile(file);
  }

  private parseFile(file: File) {
    this.importing.set(true);
    this.importError.set('');
    this.svc.parseImport(file).subscribe({
      next: (result) => {
        this.parseResult.set(result);
        this.importStep.set('preview');
        this.importing.set(false);
      },
      error: () => {
        this.importError.set('Error parsing file. Check the format.');
        this.importing.set(false);
      },
    });
  }

  commitImport() {
    const r = this.parseResult();
    if (!r || r.valid.length === 0) return;
    this.importing.set(true);
    this.importError.set('');
    this.svc.commitImport(r.valid).subscribe({
      next: (res) => {
        this.commitResult.set(res);
        this.importStep.set('done');
        this.importing.set(false);
      },
      error: () => {
        this.importError.set('Error committing import.');
        this.importing.set(false);
      },
    });
  }
}
