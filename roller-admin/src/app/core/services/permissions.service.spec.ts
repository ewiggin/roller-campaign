import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PermissionsService } from './permissions.service';
import type { RolePermissions } from '../models/settings.model';

const ALL_SCREENS = [
  'dashboard',
  'regions',
  'hosts',
  'guest-groups',
  'guests',
  'activities',
  'volunteers',
  'carts',
];

function makeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.sig`;
}

function setup(role: string) {
  localStorage.setItem(
    'admin_token',
    makeJwt({ sub: '1', email: 'a@b.com', role, iat: 0, exp: 9999999999 }),
  );
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
  return {
    service: TestBed.inject(PermissionsService),
    http: TestBed.inject(HttpTestingController),
  };
}

const FULL_PERMISSIONS: RolePermissions = {
  region_admin: ALL_SCREENS,
  volunteer: [],
  volunteer_manager: ['activities'],
  guest_manager: ['guests', 'guest-groups'],
  host_manager: ['hosts'],
};

describe('PermissionsService', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    localStorage.removeItem('admin_token');
  });

  describe('default permissions', () => {
    it('includes all five configurable roles', () => {
      const { service } = setup('superadmin');
      const perms = service.permissions();
      expect(perms).toHaveProperty('region_admin');
      expect(perms).toHaveProperty('volunteer');
      expect(perms).toHaveProperty('volunteer_manager');
      expect(perms).toHaveProperty('guest_manager');
      expect(perms).toHaveProperty('host_manager');
    });

    it('region_admin defaults to all screens', () => {
      const { service } = setup('superadmin');
      expect(service.permissions().region_admin).toEqual(expect.arrayContaining(ALL_SCREENS));
      expect(service.permissions().region_admin).toHaveLength(8);
    });

    it('new roles default to empty array', () => {
      const { service } = setup('superadmin');
      const perms = service.permissions();
      expect(perms.volunteer_manager).toEqual([]);
      expect(perms.guest_manager).toEqual([]);
      expect(perms.host_manager).toEqual([]);
    });
  });

  describe('canAccess()', () => {
    it('always returns true for superadmin regardless of screen', () => {
      const { service } = setup('superadmin');
      expect(service.canAccess('dashboard')).toBe(true);
      expect(service.canAccess('guests')).toBe(true);
      expect(service.canAccess('nonexistent-screen')).toBe(true);
    });

    it('volunteer_manager can access granted screen', async () => {
      const { service, http } = setup('volunteer_manager');
      const p = service.load();
      http.expectOne('/api/settings/permissions').flush(FULL_PERMISSIONS);
      await p;
      expect(service.canAccess('activities')).toBe(true);
    });

    it('volunteer_manager cannot access non-granted screens', async () => {
      const { service, http } = setup('volunteer_manager');
      const p = service.load();
      http.expectOne('/api/settings/permissions').flush(FULL_PERMISSIONS);
      await p;
      expect(service.canAccess('dashboard')).toBe(false);
      expect(service.canAccess('guests')).toBe(false);
      expect(service.canAccess('regions')).toBe(false);
    });

    it('guest_manager can access granted screens', async () => {
      const { service, http } = setup('guest_manager');
      const p = service.load();
      http.expectOne('/api/settings/permissions').flush(FULL_PERMISSIONS);
      await p;
      expect(service.canAccess('guests')).toBe(true);
      expect(service.canAccess('guest-groups')).toBe(true);
    });

    it('guest_manager cannot access non-granted screens', async () => {
      const { service, http } = setup('guest_manager');
      const p = service.load();
      http.expectOne('/api/settings/permissions').flush(FULL_PERMISSIONS);
      await p;
      expect(service.canAccess('hosts')).toBe(false);
      expect(service.canAccess('activities')).toBe(false);
    });

    it('host_manager can access granted screen', async () => {
      const { service, http } = setup('host_manager');
      const p = service.load();
      http.expectOne('/api/settings/permissions').flush(FULL_PERMISSIONS);
      await p;
      expect(service.canAccess('hosts')).toBe(true);
    });

    it('host_manager cannot access non-granted screens', async () => {
      const { service, http } = setup('host_manager');
      const p = service.load();
      http.expectOne('/api/settings/permissions').flush(FULL_PERMISSIONS);
      await p;
      expect(service.canAccess('guests')).toBe(false);
      expect(service.canAccess('activities')).toBe(false);
    });

    it('uses defaults when API call fails', async () => {
      const { service, http } = setup('volunteer');
      const p = service.load();
      http.expectOne('/api/settings/permissions').flush(null, { status: 500, statusText: 'Error' });
      await p;
      expect(service.canAccess('dashboard')).toBe(false);
    });
  });

  describe('load()', () => {
    it('fetches from API and updates signal', async () => {
      const { service, http } = setup('region_admin');
      const p = service.load();
      http.expectOne('/api/settings/permissions').flush(FULL_PERMISSIONS);
      await p;
      expect(service.permissions().volunteer_manager).toEqual(['activities']);
      expect(service.permissions().guest_manager).toEqual(['guests', 'guest-groups']);
      expect(service.permissions().host_manager).toEqual(['hosts']);
    });

    it('deduplicates concurrent calls — only one HTTP request', async () => {
      const { service, http } = setup('region_admin');
      const p1 = service.load();
      const p2 = service.load();
      // expectOne throws if more than one matching request exists
      http.expectOne('/api/settings/permissions').flush(FULL_PERMISSIONS);
      await Promise.all([p1, p2]);
    });
  });

  describe('reload()', () => {
    it('clears cache and fetches again', async () => {
      const { service, http } = setup('region_admin');

      const p1 = service.load();
      http.expectOne('/api/settings/permissions').flush(FULL_PERMISSIONS);
      await p1;

      service.reload();

      const updated: RolePermissions = {
        ...FULL_PERMISSIONS,
        volunteer_manager: ['dashboard', 'activities'],
      };
      http.expectOne('/api/settings/permissions').flush(updated);
      await service.load();

      expect(service.permissions().volunteer_manager).toEqual(['dashboard', 'activities']);
    });
  });
});
