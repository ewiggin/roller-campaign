import { Component, EventEmitter, Input, Output, inject, signal, computed } from '@angular/core';
import { Observable, catchError, concatMap, from, last, map, of } from 'rxjs';
import type { Activity, PreachingGroup } from '../../../core/models/activity.model';
import { ActivitiesService } from '../../../core/services/activities.service';
import { ToastService } from '../../../core/services/toast.service';

interface ImportSection {
  base: boolean;
  volunteers: boolean;
  guestGroups: boolean;
  preachingGroups: boolean;
}

interface ImportEntry {
  activity: Activity;
  existsLocally: boolean;
  hasVolunteers: boolean;
  hasGuestGroups: boolean;
  hasPreachingGroups: boolean;
  sections: ImportSection;
  status: 'idle' | 'processing' | 'done' | 'error';
  error: string;
}

@Component({
  selector: 'app-activity-import-modal',
  templateUrl: './activity-import-modal.html',
})
export class ActivityImportModalComponent {
  @Output() imported = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();
  @Input() isPreachingShift = false;
  @Input() isFoodShift = false;

  private readonly svc = inject(ActivitiesService);
  private readonly toast = inject(ToastService);

  readonly step = signal<'file' | 'merge'>('file');
  readonly entries = signal<ImportEntry[]>([]);
  readonly fileError = signal('');
  readonly parseErrors = signal<string[]>([]);
  readonly importing = signal(false);

  readonly processedCount = computed(() =>
    this.entries().filter(e => e.status === 'done' || e.status === 'error').length,
  );

  readonly errorCount = computed(() => this.entries().filter(e => e.status === 'error').length);

  readonly activeCount = computed(() =>
    this.entries().filter(e => Object.values(e.sections).some(Boolean)).length,
  );

  async onFileChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.fileError.set('');
    this.parseErrors.set([]);

    if (file.name.toLowerCase().endsWith('.xlsx')) {
      this.svc.parseExcelImport(file, {
        is_preaching_shift: this.isPreachingShift || undefined,
        is_food_shift: this.isFoodShift || undefined,
      }).subscribe({
        next: ({ activities, errors }) => {
          this.parseErrors.set(errors);
          if (!activities.length) {
            this.fileError.set('El archivo no contiene filas válidas.');
            return;
          }
          this.buildEntries(activities);
        },
        error: () => this.fileError.set('Error al procesar el archivo Excel.'),
      });
    } else {
      let activities: Activity[];
      try {
        const parsed = JSON.parse(await file.text());
        activities = Array.isArray(parsed) ? parsed : [parsed];
        if (!activities.length || !activities[0]?.id) throw new Error();
      } catch {
        this.fileError.set('El archivo no contiene actividades válidas.');
        return;
      }
      this.buildEntries(activities);
    }
  }

  private buildEntries(activities: Activity[]) {
    this.svc.getAll({ limit: 500 }).subscribe({
      next: res => {
        const localIds = new Set(res.data.map(a => a.id));
        this.entries.set(
          activities.map(a => {
            const hasVols = (a.volunteers?.length ?? 0) > 0;
            const hasGroups = (a.guest_groups?.length ?? 0) > 0;
            const hasPG = (a.preaching_groups?.length ?? 0) > 0;
            return {
              activity: a,
              existsLocally: localIds.has(a.id),
              hasVolunteers: hasVols,
              hasGuestGroups: hasGroups,
              hasPreachingGroups: hasPG,
              sections: { base: true, volunteers: hasVols, guestGroups: hasGroups, preachingGroups: hasPG },
              status: 'idle',
              error: '',
            };
          }),
        );
        this.step.set('merge');
      },
      error: () => this.fileError.set('Error al verificar actividades locales.'),
    });
  }

  toggleSection(index: number, section: keyof ImportSection) {
    this.entries.update(list => {
      const copy = [...list];
      copy[index] = {
        ...copy[index],
        sections: { ...copy[index].sections, [section]: !copy[index].sections[section] },
      };
      return copy;
    });
  }

  startImport() {
    this.importing.set(true);
    this.processNext(0);
  }

  private processNext(index: number) {
    const entries = this.entries();
    if (index >= entries.length) {
      this.importing.set(false);
      const errors = this.errorCount();
      if (errors === 0) {
        this.toast.show('Importación completada.', 'info');
        this.imported.emit();
      } else {
        this.toast.show(`Importación completada con ${errors} error${errors !== 1 ? 'es' : ''}.`);
      }
      return;
    }

    const entry = entries[index];
    if (!Object.values(entry.sections).some(Boolean)) {
      this.setStatus(index, 'done');
      this.processNext(index + 1);
      return;
    }

    this.setStatus(index, 'processing');
    this.runImport(entry).subscribe({
      next: () => {
        this.setStatus(index, 'done');
        this.processNext(index + 1);
      },
      error: (err: unknown) => {
        const msg =
          (err as { error?: { message?: string } })?.error?.message ?? 'Error desconocido';
        this.entries.update(list => {
          const copy = [...list];
          copy[index] = { ...copy[index], status: 'error', error: msg };
          return copy;
        });
        this.processNext(index + 1);
      },
    });
  }

  private runImport(entry: ImportEntry): Observable<unknown> {
    const { activity, sections } = entry;
    const ops: Observable<unknown>[] = [];

    if (!entry.existsLocally) {
      ops.push(
        this.svc.create({
          id: activity.id,
          region_id: activity.region_id,
          name: activity.name,
          icon: activity.icon,
          description: activity.description,
          date: activity.date,
          start_time: activity.start_time,
          end_time: activity.end_time,
          host_id: activity.host_id,
          required_volunteers: activity.required_volunteers,
          max_guests: activity.max_guests,
          activity_locations: activity.activity_locations,
          is_preaching_shift: activity.is_preaching_shift,
          is_food_shift: activity.is_food_shift,
          request_attendance: activity.request_attendance,
        }),
      );
    } else if (sections.base) {
      ops.push(
        this.svc.update(activity.id, {
          name: activity.name,
          icon: activity.icon,
          description: activity.description,
          date: activity.date,
          start_time: activity.start_time,
          end_time: activity.end_time,
          host_id: activity.host_id,
          required_volunteers: activity.required_volunteers,
          max_guests: activity.max_guests,
          activity_locations: activity.activity_locations,
          is_preaching_shift: activity.is_preaching_shift,
          is_food_shift: activity.is_food_shift,
          request_attendance: activity.request_attendance,
        }),
      );
    }

    if (sections.volunteers && activity.volunteers?.length) {
      ops.push(this.importVolunteers(activity));
    }

    if (sections.guestGroups && activity.guest_groups?.length) {
      ops.push(this.importGuestGroups(activity));
    }

    if (sections.preachingGroups && activity.preaching_groups?.length) {
      ops.push(this.importPreachingGroups(activity));
    }

    if (!ops.length) return of(null);
    return from(ops).pipe(concatMap(op => op), last());
  }

  private importVolunteers(activity: Activity): Observable<unknown> {
    return this.svc.getAvailableVolunteers(activity.id).pipe(
      concatMap(available => {
        const ops = (activity.volunteers ?? [])
          .map(v => available.find(a => a.volunteer_code === v.volunteer_code))
          .filter((v): v is NonNullable<typeof v> => !!v)
          .map(v =>
            this.svc
              .assignVolunteer(activity.id, v.id)
              .pipe(catchError(() => of(null))),
          );
        if (!ops.length) return of(null);
        return from(ops).pipe(concatMap(op => op), last());
      }),
    );
  }

  private importGuestGroups(activity: Activity): Observable<unknown> {
    return this.svc.getAvailableGroups(activity.id).pipe(
      concatMap(available => {
        const ops = (activity.guest_groups ?? [])
          .map(g => available.find(a => a.group_code === g.group_code))
          .filter((g): g is NonNullable<typeof g> => !!g)
          .map(g =>
            this.svc
              .assignGuestGroup(activity.id, g.id)
              .pipe(catchError(() => of(null))),
          );
        if (!ops.length) return of(null);
        return from(ops).pipe(concatMap(op => op), last());
      }),
    );
  }

  // Preaching groups: create missing groups and fill volunteers + guest groups within them.
  // Volunteers/groups are matched by code against the local activity state (fetched fresh
  // so it includes any assignments done in the base/volunteers/groups steps above).
  private importPreachingGroups(activity: Activity): Observable<unknown> {
    return this.svc.getOne(activity.id).pipe(
      concatMap(localActivity => {
        const volMap = new Map(localActivity.volunteers.map(v => [v.volunteer_code, v.id]));
        const groupMap = new Map(localActivity.guest_groups.map(g => [g.group_code, g.id]));

        return (activity.preaching_groups ?? []).reduce(
          (acc$: Observable<Activity>, importedGroup) =>
            acc$.pipe(
              concatMap(current =>
                this.importSinglePreachingGroup(current, importedGroup, volMap, groupMap),
              ),
            ),
          of(localActivity),
        );
      }),
    );
  }

  private importSinglePreachingGroup(
    localActivity: Activity,
    importedGroup: PreachingGroup,
    volMap: Map<string, string>,
    groupMap: Map<string, string>,
  ): Observable<Activity> {
    const existing = localActivity.preaching_groups.find(g => g.name === importedGroup.name);

    const ensureGroup$: Observable<{ groupId: string; current: Activity }> = existing
      ? of({ groupId: existing.id, current: localActivity })
      : this.svc.addPreachingGroup(localActivity.id, importedGroup.name).pipe(
          map(updated => {
            const created = updated.preaching_groups.find(
              g =>
                g.name === importedGroup.name &&
                !localActivity.preaching_groups.some(e => e.id === g.id),
            );
            return { groupId: created?.id ?? '', current: updated };
          }),
        );

    return ensureGroup$.pipe(
      concatMap(({ groupId, current }) => {
        if (!groupId) return of(current);
        const currentGroup = current.preaching_groups.find(g => g.id === groupId);
        if (!currentGroup) return of(current);

        const existingVolCodes = new Set(currentGroup.volunteers.map(v => v.volunteer_code));
        const volOps = importedGroup.volunteers
          .filter(v => !existingVolCodes.has(v.volunteer_code))
          .map(v => volMap.get(v.volunteer_code))
          .filter((id): id is string => !!id)
          .map(id =>
            this.svc
              .assignVolunteerToGroup(localActivity.id, groupId, id)
              .pipe(catchError(() => of(current))),
          );

        const existingGroupCodes = new Set(currentGroup.guest_groups.map(g => g.group_code));
        const groupOps = importedGroup.guest_groups
          .filter(g => !existingGroupCodes.has(g.group_code))
          .map(g => groupMap.get(g.group_code))
          .filter((id): id is string => !!id)
          .map(id =>
            this.svc
              .assignGuestGroupToGroup(localActivity.id, groupId, id)
              .pipe(catchError(() => of(current))),
          );

        const allOps = [...volOps, ...groupOps];
        if (!allOps.length) return of(current);
        return from(allOps).pipe(
          concatMap(op => op),
          last(),
          map(result => (result as Activity) ?? current),
        );
      }),
    );
  }

  private setStatus(index: number, status: ImportEntry['status']) {
    this.entries.update(list => {
      const copy = [...list];
      copy[index] = { ...copy[index], status };
      return copy;
    });
  }
}
