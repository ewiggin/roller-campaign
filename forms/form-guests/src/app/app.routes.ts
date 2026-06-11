import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/guest-form/guest-form.component').then((m) => m.GuestFormComponent),
  },
  {
    path: 'legal',
    loadComponent: () => import('./pages/legal/legal').then((m) => m.LegalComponent),
  },
  { path: '**', redirectTo: '' },
];
