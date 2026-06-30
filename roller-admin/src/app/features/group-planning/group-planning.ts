import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  ActivitiesService,
  type GroupScheduleActivity,
} from '../../core/services/activities.service';

@Component({
  selector: 'app-group-planning',
  templateUrl: './group-planning.html',
})
export class GroupPlanningComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly activitiesSvc = inject(ActivitiesService);

  readonly groupCode = signal('');
  readonly days = signal<string[]>([]);
  readonly activities = signal<GroupScheduleActivity[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  ngOnInit() {
    const params = this.route.snapshot.queryParamMap;
    const groupId = params.get('groupId') ?? '';
    this.groupCode.set(params.get('groupCode') ?? groupId);

    if (!groupId) {
      this.error.set('Missing groupId');
      this.loading.set(false);
      return;
    }

    this.activitiesSvc.getGroupSchedule(groupId).subscribe({
      next: (data) => {
        this.days.set(data.days);
        this.activities.set(data.activities);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Error loading schedule.');
        this.loading.set(false);
      },
    });
  }

  timeslots(): string[] {
    const times = new Set(
      this.activities()
        .filter((a) => !a.is_congregation_meeting)
        .map((a) => a.start_time),
    );
    return [...times].sort();
  }

  cellActivities(day: string, time: string): GroupScheduleActivity[] {
    return this.activities().filter((a) => a.date === day && a.start_time === time);
  }

  shortDayLabel(iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `${names[d.getDay()]} ${d.getDate()}`;
  }
}
