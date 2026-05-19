import {
  Component,
  OnInit,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { NgStyle } from '@angular/common';
import type { Activity } from '../../../core/models/activity.model';

export type CalendarView = 'month' | 'week' | 'day';

const HOUR_START = 7;
const HOUR_END = 22;
const PX_PER_HOUR = 64;
const TOTAL_HEIGHT = (HOUR_END - HOUR_START) * PX_PER_HOUR;

interface Layout { col: number; totalCols: number; }

@Component({
  selector: 'app-calendar',
  imports: [NgStyle],
  templateUrl: './calendar.html',
})
export class CalendarComponent implements OnInit {
  readonly activities = input<Activity[]>([]);
  readonly loading = input(false);

  readonly activityClick = output<string>();
  readonly periodChange = output<{ dateFrom: string; dateTo: string }>();

  readonly view = signal<CalendarView>('month');
  readonly anchor = signal(new Date());

  // Month: which cell is expanded to show all events
  readonly expandedMonthCell = signal<string | null>(null);

  readonly HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
  readonly TOTAL_HEIGHT = TOTAL_HEIGHT;
  readonly DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  readonly nowY = (() => {
    const now = new Date();
    return Math.max(0, (now.getHours() - HOUR_START) * PX_PER_HOUR + now.getMinutes() * (PX_PER_HOUR / 60));
  })();

  private readonly todayStr = this.toISO(new Date());

  // ── Labels ────────────────────────────────────────────────────────────────

  readonly periodLabel = computed(() => {
    const a = this.anchor();
    switch (this.view()) {
      case 'month':
        return a.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      case 'week': {
        const mon = this.getMonday(a);
        const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
        return `${mon.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${sun.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
      }
      case 'day':
        return a.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
  });

  // ── Month grid ────────────────────────────────────────────────────────────

  readonly monthGrid = computed(() => {
    const a = this.anchor();
    const year = a.getFullYear();
    const month = a.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
    const pad = (n: number) => String(n).padStart(2, '0');

    const cells: { dateStr: string | null; day: number | null; isToday: boolean; acts: Activity[] }[] = [];

    for (let i = 0; i < firstWeekday; i++) cells.push({ dateStr: null, day: null, isToday: false, acts: [] });

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${pad(month + 1)}-${pad(d)}`;
      cells.push({ dateStr, day: d, isToday: dateStr === this.todayStr, acts: this.activities().filter((a) => a.date === dateStr) });
    }

    while (cells.length % 7 !== 0) cells.push({ dateStr: null, day: null, isToday: false, acts: [] });

    const weeks: (typeof cells)[] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  });

  // ── Week columns (with overlap layout) ───────────────────────────────────

  readonly weekDays = computed(() => {
    const mon = this.getMonday(this.anchor());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i);
      const dateStr = this.toISO(d);
      const acts = this.activities().filter((a) => a.date === dateStr);
      return {
        dateStr,
        dayName: d.toLocaleDateString('en-GB', { weekday: 'short' }),
        dayNum: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        isToday: dateStr === this.todayStr,
        acts,
        layout: this.computeLayout(acts),
      };
    });
  });

  // ── Day (with overlap layout) ─────────────────────────────────────────────

  readonly dayInfo = computed(() => {
    const dateStr = this.toISO(this.anchor());
    const acts = this.activities().filter((a) => a.date === dateStr);
    return { dateStr, isToday: dateStr === this.todayStr, acts, layout: this.computeLayout(acts) };
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit() {
    this.emitPeriod();
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  prev() {
    const a = new Date(this.anchor());
    switch (this.view()) {
      case 'month': a.setMonth(a.getMonth() - 1); break;
      case 'week': a.setDate(a.getDate() - 7); break;
      case 'day': a.setDate(a.getDate() - 1); break;
    }
    this.anchor.set(a);
    this.expandedMonthCell.set(null);
    this.emitPeriod();
  }

  next() {
    const a = new Date(this.anchor());
    switch (this.view()) {
      case 'month': a.setMonth(a.getMonth() + 1); break;
      case 'week': a.setDate(a.getDate() + 7); break;
      case 'day': a.setDate(a.getDate() + 1); break;
    }
    this.anchor.set(a);
    this.expandedMonthCell.set(null);
    this.emitPeriod();
  }

  today() {
    this.anchor.set(new Date());
    this.expandedMonthCell.set(null);
    this.emitPeriod();
  }

  setView(v: CalendarView) {
    this.view.set(v);
    this.expandedMonthCell.set(null);
    this.emitPeriod();
  }

  // ── Month expand ──────────────────────────────────────────────────────────

  toggleMonthCell(dateStr: string) {
    this.expandedMonthCell.set(this.expandedMonthCell() === dateStr ? null : dateStr);
  }

  // ── Activity positioning ──────────────────────────────────────────────────

  activityTimelineStyle(activity: Activity, layout: Map<string, Layout>): Record<string, string> {
    const { col, totalCols } = layout.get(activity.id) ?? { col: 0, totalCols: 1 };
    const [sh, sm] = activity.start_time.split(':').map(Number);
    const [eh, em] = activity.end_time.split(':').map(Number);
    const top = Math.max(0, (sh - HOUR_START) * PX_PER_HOUR + sm * (PX_PER_HOUR / 60));
    const height = Math.max(((eh - sh) * 60 + (em - sm)) * (PX_PER_HOUR / 60), 28);
    const leftPct = (col / totalCols * 100).toFixed(2);
    const widthPct = (100 / totalCols).toFixed(2);
    return {
      top: `${top}px`,
      height: `${height}px`,
      left: `calc(${leftPct}% + 2px)`,
      width: `calc(${widthPct}% - 4px)`,
    };
  }

  activityChipClass(status: string): string {
    return status === 'published'
      ? 'bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900'
      : 'bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900';
  }

  formatHour(h: number): string {
    return `${String(h).padStart(2, '0')}:00`;
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private computeLayout(acts: Activity[]): Map<string, Layout> {
    const result = new Map<string, Layout>();
    if (!acts.length) return result;

    const sorted = [...acts].sort((a, b) => a.start_time.localeCompare(b.start_time));
    const colEndTimes: string[] = [];
    const colOf = new Map<string, number>();

    for (const act of sorted) {
      let col = colEndTimes.findIndex((end) => end <= act.start_time);
      if (col === -1) col = colEndTimes.length;
      colEndTimes[col] = act.end_time;
      colOf.set(act.id, col);
    }

    for (const act of sorted) {
      let maxCol = 0;
      for (const other of sorted) {
        if (act.start_time < other.end_time && act.end_time > other.start_time) {
          maxCol = Math.max(maxCol, colOf.get(other.id)!);
        }
      }
      result.set(act.id, { col: colOf.get(act.id)!, totalCols: maxCol + 1 });
    }

    return result;
  }

  private emitPeriod() {
    const a = this.anchor();
    let dateFrom: string;
    let dateTo: string;

    switch (this.view()) {
      case 'month': {
        const y = a.getFullYear(); const m = a.getMonth();
        dateFrom = this.ymd(y, m + 1, 1);
        dateTo = this.ymd(y, m + 1, new Date(y, m + 1, 0).getDate());
        break;
      }
      case 'week': {
        const mon = this.getMonday(a);
        dateFrom = this.toISO(mon);
        const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
        dateTo = this.toISO(sun);
        break;
      }
      case 'day':
        dateFrom = dateTo = this.toISO(a);
        break;
    }

    this.periodChange.emit({ dateFrom, dateTo });
  }

  private getMonday(d: Date): Date {
    const day = d.getDay();
    const offset = day === 0 ? -6 : 1 - day;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset);
  }

  private toISO(d: Date): string {
    return this.ymd(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }

  private ymd(y: number, m: number, d: number): string {
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
}
