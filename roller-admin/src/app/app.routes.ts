import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { permissionsGuard } from './core/guards/permissions.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'admin', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./features/login/login').then((m) => m.LoginComponent),
  },
  {
    path: 'admin',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/admin/layout/layout').then((m) => m.AdminLayoutComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        data: { screen: 'dashboard' },
        canActivate: [permissionsGuard],
        loadComponent: () =>
          import('./features/admin/dashboard/dashboard').then((m) => m.DashboardComponent),
      },
      {
        path: 'regions',
        data: { screen: 'regions' },
        canActivate: [permissionsGuard],
        loadComponent: () =>
          import('./features/admin/regions/regions-list').then((m) => m.RegionsListComponent),
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./features/admin/users/users-list').then((m) => m.UsersListComponent),
      },
      {
        path: 'hosts',
        data: { screen: 'hosts' },
        canActivate: [permissionsGuard],
        loadComponent: () =>
          import('./features/admin/hosts/hosts-list').then((m) => m.HostsListComponent),
      },
      {
        path: 'hosts/:id',
        data: { screen: 'hosts' },
        canActivate: [permissionsGuard],
        loadComponent: () =>
          import('./features/admin/hosts/host-detail').then((m) => m.HostDetailComponent),
      },
      {
        path: 'guest-groups',
        data: { screen: 'guest-groups' },
        canActivate: [permissionsGuard],
        loadComponent: () =>
          import('./features/admin/guest-groups/guest-groups-list').then(
            (m) => m.GuestGroupsListComponent,
          ),
      },
      {
        path: 'guests',
        data: { screen: 'guests' },
        canActivate: [permissionsGuard],
        loadComponent: () =>
          import('./features/admin/guests/guests-list').then((m) => m.GuestsListComponent),
      },
      {
        path: 'guests/:id',
        data: { screen: 'guests' },
        canActivate: [permissionsGuard],
        loadComponent: () =>
          import('./features/admin/guests/guest-detail').then((m) => m.GuestDetailComponent),
      },
      {
        path: 'volunteers',
        data: { screen: 'volunteers' },
        canActivate: [permissionsGuard],
        loadComponent: () =>
          import('./features/admin/volunteers/volunteers-list').then(
            (m) => m.VolunteersListComponent,
          ),
      },
      {
        path: 'volunteers/:id',
        data: { screen: 'volunteers' },
        canActivate: [permissionsGuard],
        loadComponent: () =>
          import('./features/admin/volunteers/volunteer-detail').then(
            (m) => m.VolunteerDetailComponent,
          ),
      },
      {
        path: 'volunteer-roles',
        data: { screen: 'volunteers' },
        canActivate: [permissionsGuard],
        loadComponent: () =>
          import('./features/admin/volunteers/volunteer-roles-list').then(
            (m) => m.VolunteerRolesListComponent,
          ),
      },
      {
        path: 'activities',
        data: { screen: 'activities' },
        canActivate: [permissionsGuard],
        loadComponent: () =>
          import('./features/admin/activities/activities-list').then(
            (m) => m.ActivitiesListComponent,
          ),
      },
      {
        path: 'preaching-shifts',
        data: { screen: 'activities', preachingShiftsOnly: true },
        canActivate: [permissionsGuard],
        loadComponent: () =>
          import('./features/admin/activities/activities-list').then(
            (m) => m.ActivitiesListComponent,
          ),
      },
      {
        path: 'food-shifts',
        data: { screen: 'activities', foodShiftsOnly: true },
        canActivate: [permissionsGuard],
        loadComponent: () =>
          import('./features/admin/activities/activities-list').then(
            (m) => m.ActivitiesListComponent,
          ),
      },
      {
        path: 'carts',
        data: { screen: 'carts' },
        canActivate: [permissionsGuard],
        loadComponent: () =>
          import('./features/admin/carts/carts-list').then((m) => m.CartsListComponent),
      },
      {
        path: 'audit-logs',
        loadComponent: () =>
          import('./features/admin/audit-logs/audit-logs-list').then(
            (m) => m.AuditLogsListComponent,
          ),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/admin/settings/settings').then((m) => m.SettingsComponent),
      },
      {
        path: 'unauthorized',
        loadComponent: () =>
          import('./features/admin/unauthorized/unauthorized').then((m) => m.UnauthorizedComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'admin' },
];
