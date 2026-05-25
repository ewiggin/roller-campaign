import { TestBed } from '@angular/core/testing';
import { Component, viewChild } from '@angular/core';
import { CalendarComponent, computeLayout } from './calendar';

// ── computeLayout (pure function) ─────────────────────────────────────────

const act = (id: string, start: string, end: string) => ({ id, start_time: start, end_time: end });

describe('computeLayout', () => {
  it('returns empty map for no activities', () => {
    expect(computeLayout([])).toEqual(new Map());
  });

  it('single activity: col=0, totalCols=1', () => {
    const layout = computeLayout([act('a', '09:00', '11:00')]);
    expect(layout.get('a')).toEqual({ col: 0, totalCols: 1 });
  });

  it('two non-overlapping activities: both col=0, totalCols=1', () => {
    const layout = computeLayout([act('a', '09:00', '11:00'), act('b', '13:00', '15:00')]);
    expect(layout.get('a')).toEqual({ col: 0, totalCols: 1 });
    expect(layout.get('b')).toEqual({ col: 0, totalCols: 1 });
  });

  it('adjacent activities (end == start of next) do not overlap', () => {
    const layout = computeLayout([act('a', '09:00', '11:00'), act('b', '11:00', '13:00')]);
    expect(layout.get('a')).toEqual({ col: 0, totalCols: 1 });
    expect(layout.get('b')).toEqual({ col: 0, totalCols: 1 });
  });

  it('two overlapping: cols 0 and 1, totalCols=2 each', () => {
    const layout = computeLayout([act('a', '09:00', '11:00'), act('b', '10:00', '12:00')]);
    expect(layout.get('a')?.col).toBe(0);
    expect(layout.get('b')?.col).toBe(1);
    expect(layout.get('a')?.totalCols).toBe(2);
    expect(layout.get('b')?.totalCols).toBe(2);
  });

  it('three concurrent activities: cols 0,1,2 with totalCols=3', () => {
    const layout = computeLayout([
      act('a', '09:00', '12:00'),
      act('b', '09:30', '11:30'),
      act('c', '10:00', '13:00'),
    ]);
    const cols = ['a', 'b', 'c'].map((id) => layout.get(id)!.col).sort((a, b) => a - b);
    expect(cols).toEqual([0, 1, 2]);
    expect(layout.get('a')?.totalCols).toBe(3);
    expect(layout.get('b')?.totalCols).toBe(3);
    expect(layout.get('c')?.totalCols).toBe(3);
  });

  it('two separate overlap groups have independent totalCols', () => {
    // Group 1: a+b overlap (totalCols=2). Group 2: c alone (totalCols=1).
    const layout = computeLayout([
      act('a', '08:00', '10:00'),
      act('b', '09:00', '11:00'),
      act('c', '14:00', '16:00'),
    ]);
    expect(layout.get('a')?.totalCols).toBe(2);
    expect(layout.get('b')?.totalCols).toBe(2);
    expect(layout.get('c')?.totalCols).toBe(1);
  });

  it('reuses freed column slot', () => {
    // a ends at 10:00, c starts at 10:00 → c can reuse col 0
    const layout = computeLayout([
      act('a', '08:00', '10:00'),
      act('b', '08:30', '12:00'),
      act('c', '10:00', '12:00'),
    ]);
    // a=col0, b=col1, c=col0 (reuse)
    expect(layout.get('a')?.col).toBe(0);
    expect(layout.get('b')?.col).toBe(1);
    expect(layout.get('c')?.col).toBe(0);
    // b overlaps a and c, so totalCols for b = 2
    expect(layout.get('b')?.totalCols).toBe(2);
  });
});

// ── CalendarComponent – expandedMonthCell ────────────────────────────────

@Component({
  standalone: true,
  imports: [CalendarComponent],
  template: `<app-calendar [activities]="[]" (periodChange)="$event" />`,
})
class HostComponent {
  readonly cal = viewChild.required(CalendarComponent);
}

describe('CalendarComponent – expandedMonthCell', () => {
  let cal: CalendarComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    cal = fixture.componentInstance.cal();
    cal.setView('month');
  });

  it('starts collapsed', () => {
    expect(cal.expandedMonthCell()).toBeNull();
  });

  it('toggleMonthCell expands', () => {
    cal.toggleMonthCell('2024-06-17');
    expect(cal.expandedMonthCell()).toBe('2024-06-17');
  });

  it('toggling the same cell collapses it', () => {
    cal.toggleMonthCell('2024-06-17');
    cal.toggleMonthCell('2024-06-17');
    expect(cal.expandedMonthCell()).toBeNull();
  });

  it('next() resets expanded cell', () => {
    cal.toggleMonthCell('2024-06-17');
    cal.next();
    expect(cal.expandedMonthCell()).toBeNull();
  });

  it('setView() resets expanded cell', () => {
    cal.toggleMonthCell('2024-06-17');
    cal.setView('week');
    expect(cal.expandedMonthCell()).toBeNull();
  });
});
