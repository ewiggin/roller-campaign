import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { PermissionsService } from '../services/permissions.service';

const SCREEN_ROUTES: { screen: string; path: string }[] = [
  { screen: 'dashboard', path: '/admin/dashboard' },
  { screen: 'regions', path: '/admin/regions' },
  { screen: 'hosts', path: '/admin/hosts' },
  { screen: 'guest-groups', path: '/admin/guest-groups' },
  { screen: 'guests', path: '/admin/guests' },
  { screen: 'activities', path: '/admin/activities' },
];

export const permissionsGuard: CanActivateFn = async (route) => {
  const auth = inject(AuthService);
  const perms = inject(PermissionsService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) return router.createUrlTree(['/login']);

  const screen = route.data?.['screen'] as string | undefined;
  if (!screen) return true;

  await perms.load();

  if (perms.canAccess(screen)) return true;

  const fallback = SCREEN_ROUTES.find((s) => s.screen !== screen && perms.canAccess(s.screen));
  return router.createUrlTree([fallback?.path ?? '/admin/unauthorized']);
};
