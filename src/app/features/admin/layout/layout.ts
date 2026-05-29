import { Component, computed, inject, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../../core/services/theme.service';
import { PermissionsService } from '../../../core/services/permissions.service';

interface NavItem {
  label: string;
  path: string;
  screen?: string;
}

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './layout.html',
})
export class AdminLayoutComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  private readonly perms = inject(PermissionsService);

  protected readonly userEmail = computed(() => this.auth.currentUser()?.email ?? '');
  protected readonly isSuperAdmin = this.auth.isSuperAdmin;

  private readonly ALL_NAV_ITEMS: NavItem[] = [
    { label: 'Dashboard', path: '/admin/dashboard', screen: 'dashboard' },
    { label: 'Regions', path: '/admin/regions', screen: 'regions' },
    { label: 'Hosts', path: '/admin/hosts', screen: 'hosts' },
    { label: 'Guest Groups', path: '/admin/guest-groups', screen: 'guest-groups' },
    { label: 'Guests', path: '/admin/guests', screen: 'guests' },
    { label: 'Activities', path: '/admin/activities', screen: 'activities' },
  ];

  protected readonly adminNavItems: NavItem[] = [
    { label: 'Users', path: '/admin/users' },
    { label: 'Audit Log', path: '/admin/audit-logs' },
    { label: 'Settings', path: '/admin/settings' },
  ];

  protected readonly navItems = computed(() => {
    if (this.isSuperAdmin()) return this.ALL_NAV_ITEMS;
    return this.ALL_NAV_ITEMS.filter((item) => !item.screen || this.perms.canAccess(item.screen));
  });

  ngOnInit() {
    this.perms.load();
  }

  logout() {
    this.auth.logout();
  }
}
