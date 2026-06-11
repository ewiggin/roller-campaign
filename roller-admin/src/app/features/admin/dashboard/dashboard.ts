import { Component, inject, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DashboardService, RegionSummary } from '../../../core/services/dashboard.service';

@Component({
  selector: 'app-dashboard',
  imports: [DatePipe],
  templateUrl: './dashboard.html',
})
export class DashboardComponent implements OnInit {
  private readonly svc = inject(DashboardService);

  readonly summaries = signal<RegionSummary[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  ngOnInit() {
    this.svc.getStats().subscribe({
      next: (rows) => {
        this.summaries.set(
          rows.map((r) => ({
            region_id: r.region_id,
            region_name: r.region_name,
            event_start_date: r.event_start_date,
            event_end_date: r.event_end_date,
            guestCount: r.guest_count,
            volunteerCount: r.volunteer_count,
            activityCount: r.activity_count,
            coveredActivities: r.covered_activities,
          })),
        );
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Error loading stats.');
        this.loading.set(false);
      },
    });
  }
}
