import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

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
        loadComponent: () =>
          import('./features/admin/dashboard/dashboard').then((m) => m.DashboardComponent),
      },
      {
        path: 'regions',
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
        loadComponent: () =>
          import('./features/admin/hosts/hosts-list').then((m) => m.HostsListComponent),
      },
      {
        path: 'hosts/:id',
        loadComponent: () =>
          import('./features/admin/hosts/host-detail').then((m) => m.HostDetailComponent),
      },
      {
        path: 'guest-groups',
        loadComponent: () =>
          import('./features/admin/guest-groups/guest-groups-list').then((m) => m.GuestGroupsListComponent),
      },
      {
        path: 'guests',
        loadComponent: () =>
          import('./features/admin/guests/guests-list').then((m) => m.GuestsListComponent),
      },
      {
        path: 'guests/:id',
        loadComponent: () =>
          import('./features/admin/guests/guest-detail').then((m) => m.GuestDetailComponent),
      },
      {
        path: 'activities',
        loadComponent: () =>
          import('./features/admin/activities/activities-list').then((m) => m.ActivitiesListComponent),
      },
      {
        path: 'audit-logs',
        loadComponent: () =>
          import('./features/admin/audit-logs/audit-logs-list').then((m) => m.AuditLogsListComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'admin' },
];
