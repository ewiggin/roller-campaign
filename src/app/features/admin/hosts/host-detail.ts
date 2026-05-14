import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HostsService } from '../../../core/services/hosts.service';
import { GuestGroupsService } from '../../../core/services/guest-groups.service';
import type { Host, GroupSuggestion } from '../../../core/models/host.model';

@Component({
  selector: 'app-host-detail',
  imports: [RouterLink],
  templateUrl: './host-detail.html',
})
export class HostDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly svc = inject(HostsService);
  private readonly groupsSvc = inject(GuestGroupsService);

  readonly host = signal<Host | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  readonly assigned = signal<GroupSuggestion[]>([]);
  readonly available = signal<GroupSuggestion[]>([]);
  readonly suggestionsLoading = signal(true);

  readonly assigning = signal<string | null>(null);
  readonly downloading = signal(false);

  readonly totalGuests = computed(() =>
    this.assigned().reduce((sum, g) => sum + g.guest_count, 0),
  );

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
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invitados-${h.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        this.downloading.set(false);
      },
      error: () => this.downloading.set(false),
    });
  }

  private sortFn(a: GroupSuggestion, b: GroupSuggestion): number {
    if (a.distance_km === null && b.distance_km === null) return a.group_code.localeCompare(b.group_code);
    if (a.distance_km === null) return 1;
    if (b.distance_km === null) return -1;
    return a.distance_km - b.distance_km;
  }

  private readonly dayNames = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

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
