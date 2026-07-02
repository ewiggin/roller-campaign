import {
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  inject,
  signal,
  computed,
  OnInit,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HostsService } from '../../../core/services/hosts.service';
import { GuestGroupsService } from '../../../core/services/guest-groups.service';
import { ActivitiesService } from '../../../core/services/activities.service';
import { downloadFile } from '../../../core/utils/download-file';
import type { Host, GroupSuggestion } from '../../../core/models/host.model';
import { SearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select';

@Component({
  selector: 'app-host-detail',
  imports: [RouterLink, SearchableSelectComponent],
  templateUrl: './host-detail.html',
})
export class HostDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly svc = inject(HostsService);
  private readonly groupsSvc = inject(GuestGroupsService);
  private readonly activitiesSvc = inject(ActivitiesService);

  readonly carsFilterItems = [
    { value: 'true', label: 'With cars' },
    { value: 'false', label: 'Without cars' },
  ];

  readonly host = signal<Host | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  readonly assigned = signal<GroupSuggestion[]>([]);
  readonly available = signal<GroupSuggestion[]>([]);
  readonly suggestionsLoading = signal(true);

  readonly assigning = signal<string | null>(null);
  readonly downloading = signal(false);
  readonly downloadingSchedulePdf = signal(false);

  readonly totalGuests = computed(() => this.assigned().reduce((sum, g) => sum + g.guest_count, 0));

  readonly remainingCapacity = computed(() => {
    const cap = this.host()?.capacity;
    if (!cap) return null;
    return cap - this.totalGuests();
  });

  readonly selectedLanguages = signal<string[]>([]);
  readonly langDropdownOpen = signal(false);
  readonly hasCars = signal<boolean | undefined>(undefined);

  readonly availableLanguages = computed(() =>
    Array.from(new Set(this.available().flatMap((g) => g.languages))).sort(),
  );

  readonly filteredAvailable = computed(() => {
    let list = this.available();
    const langs = this.selectedLanguages();
    if (langs.length > 0) list = list.filter((g) => langs.every((l) => g.languages.includes(l)));
    const cars = this.hasCars();
    if (cars === true) list = list.filter((g) => g.car_count !== null && g.car_count > 0);
    if (cars === false) list = list.filter((g) => g.car_count === null || g.car_count === 0);
    return list;
  });

  toggleLanguage(lang: string) {
    this.selectedLanguages.update((ls) =>
      ls.includes(lang) ? ls.filter((l) => l !== lang) : [...ls, lang],
    );
  }

  onHasCarsChange(value: string) {
    this.hasCars.set(value === 'true' ? true : value === 'false' ? false : undefined);
  }

  @ViewChild('langDropdown') private readonly langDropdownRef?: ElementRef<HTMLElement>;

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent) {
    if (this.langDropdownRef && !this.langDropdownRef.nativeElement.contains(e.target as Node)) {
      this.langDropdownOpen.set(false);
    }
  }

  readonly capacityBadgeClass = computed(() => {
    const rem = this.remainingCapacity();
    if (rem === null) return null;
    if (rem < 0)
      return 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950 dark:text-red-400 dark:ring-red-800';
    if (rem <= Math.ceil(this.host()!.capacity! * 0.15))
      return 'bg-green-50 text-green-700 ring-green-200 dark:bg-green-950 dark:text-green-400 dark:ring-green-800';
    return 'bg-gray-100 text-gray-500 ring-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700';
  });

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.svc.getOne(id).subscribe({
      next: (h) => {
        this.host.set(h);
        this.loading.set(false);
        this.loadSuggestions(id);
      },
      error: () => {
        this.error.set('Host not found.');
        this.loading.set(false);
      },
    });
  }

  private loadSuggestions(hostId: string) {
    this.suggestionsLoading.set(true);
    this.svc.getGroupSuggestions(hostId).subscribe({
      next: (res) => {
        this.assigned.set(res.assigned);
        this.available.set(res.available);
        this.suggestionsLoading.set(false);
      },
      error: () => this.suggestionsLoading.set(false),
    });
  }

  addGroup(group: GroupSuggestion) {
    const h = this.host();
    if (!h || this.assigning()) return;
    this.assigning.set(group.id);
    this.groupsSvc.assignHost(group.id, h.id).subscribe({
      next: () => {
        this.assigned.update((list) => [...list, group].sort(this.sortFn));
        this.available.update((list) => list.filter((g) => g.id !== group.id));
        this.assigning.set(null);
      },
      error: () => this.assigning.set(null),
    });
  }

  removeGroup(group: GroupSuggestion) {
    if (this.assigning()) return;
    this.assigning.set(group.id);
    this.groupsSvc.assignHost(group.id, null).subscribe({
      next: () => {
        this.available.update((list) => [...list, group].sort(this.sortFn));
        this.assigned.update((list) => list.filter((g) => g.id !== group.id));
        this.assigning.set(null);
      },
      error: () => this.assigning.set(null),
    });
  }

  formatDistance(km: number | null): string {
    if (km === null) return '—';
    if (km < 1) return `${Math.round(km * 1000)} m`;
    return `${km.toFixed(1)} km`;
  }

  downloadExcel() {
    const h = this.host();
    if (!h || this.downloading()) return;
    this.downloading.set(true);
    this.svc.downloadGuestsExcel(h.id).subscribe({
      next: async (blob) => {
        await downloadFile(
          blob,
          `invitados-${h.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.xlsx`,
        );
        this.downloading.set(false);
      },
      error: () => this.downloading.set(false),
    });
  }

  downloadSchedulePdf() {
    const h = this.host();
    if (!h || this.downloadingSchedulePdf()) return;
    this.downloadingSchedulePdf.set(true);
    this.activitiesSvc.exportHostSchedulesPdf(h.id).subscribe({
      next: async (blob) => {
        await downloadFile(
          blob,
          `calendario-${h.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`,
        );
        this.downloadingSchedulePdf.set(false);
      },
      error: () => this.downloadingSchedulePdf.set(false),
    });
  }

  private sortFn(a: GroupSuggestion, b: GroupSuggestion): number {
    if (a.distance_km === null && b.distance_km === null)
      return a.group_code.localeCompare(b.group_code);
    if (a.distance_km === null) return 1;
    if (b.distance_km === null) return -1;
    return a.distance_km - b.distance_km;
  }

  private readonly dayNames = [
    '',
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado',
    'Domingo',
  ];

  fmtMeeting(day: number | null, time: string | null): string {
    if (!day && !time) return '—';
    const dayStr = day ? this.dayNames[day] : '';
    const timeStr = time ?? '';
    return [dayStr, timeStr].filter(Boolean).join(' · ');
  }

  mapsUrl(): string | null {
    const h = this.host();
    if (!h?.lat || !h?.lng) return null;
    return `https://www.google.com/maps?q=${h.lat},${h.lng}`;
  }
}
