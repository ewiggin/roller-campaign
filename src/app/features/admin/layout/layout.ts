import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../../core/services/theme.service';

interface NavItem {
  label: string;
  path: string;
  icon: string;
}

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './layout.html',
})
export class AdminLayoutComponent {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);

  protected readonly userEmail = computed(() => this.auth.currentUser()?.email ?? '');
  protected readonly isSuperAdmin = this.auth.isSuperAdmin;

  protected readonly navItems: NavItem[] = [
    { label: 'Dashboard', path: '/admin/dashboard', icon: 'grid' },
    { label: 'Regions', path: '/admin/regions', icon: 'map' },
    { label: 'Hosts', path: '/admin/hosts', icon: 'home' },
    { label: 'Guest Groups', path: '/admin/guest-groups', icon: 'folder' },
    { label: 'Guests', path: '/admin/guests', icon: 'users' },
    // { label: 'Volunteers', path: '/admin/volunteers', icon: 'user-check' },
    // { label: 'Turns', path: '/admin/turns', icon: 'calendar' },
  ];

  protected readonly adminNavItems: NavItem[] = [
    { label: 'Users', path: '/admin/users', icon: 'shield' },
  ];

  logout() {
    this.auth.logout();
  }
}
