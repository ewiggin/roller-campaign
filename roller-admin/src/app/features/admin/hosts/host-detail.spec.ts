import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { HostDetailComponent } from './host-detail';
import { HostsService } from '../../../core/services/hosts.service';
import { GuestGroupsService } from '../../../core/services/guest-groups.service';
import type { GroupSuggestion } from '../../../core/models/host.model';

const makeGroup = (id: string, overrides: Partial<GroupSuggestion> = {}): GroupSuggestion => ({
  id,
  group_code: `GRP-${id}`,
  guest_count: 3,
  distance_km: null,
  languages: [],
  car_count: null,
  total_car_seats: 0,
  ...overrides,
});

const providers = [
  provideRouter([]),
  {
    provide: ActivatedRoute,
    useValue: { snapshot: { paramMap: { get: () => 'h1' } } },
  },
  {
    provide: HostsService,
    useValue: {
      getOne: () => of({ id: 'h1', name: 'Test', region_id: 'r1', lat: null, lng: null }),
      getGroupSuggestions: () => of({ assigned: [], available: [] }),
    },
  },
  {
    provide: GuestGroupsService,
    useValue: { assignHost: () => of({}) },
  },
];

async function setup() {
  await TestBed.configureTestingModule({
    imports: [HostDetailComponent],
    providers,
  }).compileComponents();
  const fixture = TestBed.createComponent(HostDetailComponent);
  fixture.detectChanges();
  return fixture.componentInstance;
}

describe('HostDetailComponent – filteredAvailable', () => {
  it('returns all groups when no filters are active', async () => {
    const c = await setup();
    c.available.set([makeGroup('1'), makeGroup('2')]);
    expect(c.filteredAvailable().length).toBe(2);
  });

  it('hasCars=true keeps only groups with car_count > 0', async () => {
    const c = await setup();
    c.available.set([
      makeGroup('1', { car_count: 2 }),
      makeGroup('2', { car_count: null }),
      makeGroup('3', { car_count: 0 }),
    ]);
    c.hasCars.set(true);
    const result = c.filteredAvailable();
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('1');
  });

  it('hasCars=false keeps groups with null or 0 car_count', async () => {
    const c = await setup();
    c.available.set([
      makeGroup('1', { car_count: 2 }),
      makeGroup('2', { car_count: null }),
      makeGroup('3', { car_count: 0 }),
    ]);
    c.hasCars.set(false);
    const result = c.filteredAvailable();
    expect(result.length).toBe(2);
    expect(result.map((g) => g.id).sort()).toEqual(['2', '3']);
  });

  it('language filter keeps only groups that include all selected languages', async () => {
    const c = await setup();
    c.available.set([
      makeGroup('1', { languages: ['Spanish', 'English'] }),
      makeGroup('2', { languages: ['Spanish'] }),
      makeGroup('3', { languages: ['French'] }),
    ]);
    c.selectedLanguages.set(['Spanish', 'English']);
    expect(c.filteredAvailable().map((g) => g.id)).toEqual(['1']);
  });

  it('combining language and hasCars filters applies both', async () => {
    const c = await setup();
    c.available.set([
      makeGroup('1', { car_count: 2, languages: ['Spanish'] }),
      makeGroup('2', { car_count: null, languages: ['Spanish'] }),
      makeGroup('3', { car_count: 2, languages: ['French'] }),
    ]);
    c.selectedLanguages.set(['Spanish']);
    c.hasCars.set(true);
    const result = c.filteredAvailable();
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('1');
  });
});

describe('HostDetailComponent – onHasCarsChange', () => {
  it('sets hasCars to true', async () => {
    const c = await setup();
    c.onHasCarsChange('true');
    expect(c.hasCars()).toBe(true);
  });

  it('sets hasCars to false', async () => {
    const c = await setup();
    c.onHasCarsChange('false');
    expect(c.hasCars()).toBe(false);
  });

  it('resets hasCars to undefined for empty string', async () => {
    const c = await setup();
    c.hasCars.set(true);
    c.onHasCarsChange('');
    expect(c.hasCars()).toBeUndefined();
  });
});
