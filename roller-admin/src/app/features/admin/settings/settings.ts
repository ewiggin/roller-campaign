import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SettingsService } from '../../../core/services/settings.service';
import { PermissionsService } from '../../../core/services/permissions.service';
import { AuthService } from '../../../core/services/auth.service';
import { CONFIGURABLE_SCREENS } from '../../../core/models/settings.model';
import type { DatabaseImportResult, ScreenKey } from '../../../core/models/settings.model';

type PermGrid = Record<
  'region_admin' | 'volunteer' | 'volunteer_manager' | 'guest_manager' | 'host_manager',
  Record<ScreenKey, boolean>
>;

const CONFIGURABLE_ROLES = [
  'region_admin',
  'volunteer',
  'volunteer_manager',
  'guest_manager',
  'host_manager',
] as const;
const ROLE_LABELS: Record<string, string> = {
  region_admin: 'Region Admin',
  volunteer: 'Volunteer',
  volunteer_manager: 'Volunteer Manager',
  guest_manager: 'Guest Manager',
  host_manager: 'Host Manager',
};

@Component({
  selector: 'app-settings',
  imports: [ReactiveFormsModule],
  templateUrl: './settings.html',
})
export class SettingsComponent implements OnInit {
  private readonly svc = inject(SettingsService);
  private readonly permsSvc = inject(PermissionsService);
  private readonly authSvc = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly screens = CONFIGURABLE_SCREENS;
  readonly roles = CONFIGURABLE_ROLES;
  readonly roleLabels = ROLE_LABELS;

  // ── SMTP ──────────────────────────────────────────────────────────────

  readonly smtpLoading = signal(true);
  readonly smtpSaving = signal(false);
  readonly smtpSaveSuccess = signal(false);
  readonly smtpError = signal('');
  readonly testing = signal(false);
  readonly testSuccess = signal(false);
  readonly testError = signal('');
  readonly testEmail = signal('');

  readonly smtpForm = this.fb.nonNullable.group({
    host: [''],
    port: [587, [Validators.min(1), Validators.max(65535)]],
    secure: [false],
    user: [''],
    password: [''],
    from_name: [''],
    from_email: [''],
    enabled: [false],
  });

  // ── Permissions ───────────────────────────────────────────────────────

  readonly permsLoading = signal(true);
  readonly permsSaving = signal(false);
  readonly permsSaveSuccess = signal(false);
  readonly permsError = signal('');

  readonly permGrid = signal<PermGrid>({
    region_admin: this.emptyGrid(),
    volunteer: this.emptyGrid(),
    volunteer_manager: this.emptyGrid(),
    guest_manager: this.emptyGrid(),
    host_manager: this.emptyGrid(),
  });

  ngOnInit() {
    this.loadSmtp();
    this.loadPermissions();
  }

  private loadSmtp() {
    this.svc.getSmtp().subscribe({
      next: (s) => {
        this.smtpForm.patchValue({
          host: s.host ?? '',
          port: s.port ?? 587,
          secure: s.secure,
          user: s.user ?? '',
          from_name: s.from_name ?? '',
          from_email: s.from_email ?? '',
          enabled: s.enabled,
        });
        this.smtpLoading.set(false);
      },
      error: () => {
        this.smtpError.set('Error al cargar la configuración SMTP.');
        this.smtpLoading.set(false);
      },
    });
  }

  saveSmtp() {
    if (this.smtpForm.invalid || this.smtpSaving()) return;
    this.smtpSaving.set(true);
    this.smtpSaveSuccess.set(false);
    this.smtpError.set('');
    const raw = this.smtpForm.getRawValue();
    const payload: Record<string, unknown> = { ...raw };
    if (!payload['password']) delete payload['password'];
    this.svc.updateSmtp(payload).subscribe({
      next: () => {
        this.smtpSaving.set(false);
        this.smtpSaveSuccess.set(true);
        this.smtpForm.get('password')!.reset('');
        setTimeout(() => this.smtpSaveSuccess.set(false), 3000);
      },
      error: () => {
        this.smtpError.set('Error al guardar la configuración SMTP.');
        this.smtpSaving.set(false);
      },
    });
  }

  sendTest() {
    const to = this.testEmail();
    if (!to || this.testing()) return;
    this.testing.set(true);
    this.testSuccess.set(false);
    this.testError.set('');
    this.svc.testSmtp(to).subscribe({
      next: () => {
        this.testing.set(false);
        this.testSuccess.set(true);
        setTimeout(() => this.testSuccess.set(false), 5000);
      },
      error: () => {
        this.testError.set('Error al enviar el correo. Verifica la configuración SMTP.');
        this.testing.set(false);
      },
    });
  }

  updateTestEmail(value: string) {
    this.testEmail.set(value);
  }

  // ── Permissions ───────────────────────────────────────────────────────

  private loadPermissions() {
    this.svc.getPermissions().subscribe({
      next: (p) => {
        this.permGrid.set({
          region_admin: this.screensToGrid(p.region_admin),
          volunteer: this.screensToGrid(p.volunteer),
          volunteer_manager: this.screensToGrid(p.volunteer_manager),
          guest_manager: this.screensToGrid(p.guest_manager),
          host_manager: this.screensToGrid(p.host_manager),
        });
        this.permsLoading.set(false);
      },
      error: () => {
        this.permsError.set('Error al cargar los permisos.');
        this.permsLoading.set(false);
      },
    });
  }

  togglePerm(role: keyof PermGrid, screen: ScreenKey) {
    this.permGrid.update((grid) => ({
      ...grid,
      [role]: { ...grid[role], [screen]: !grid[role][screen] },
    }));
  }

  hasPerm(role: keyof PermGrid, screen: ScreenKey): boolean {
    return this.permGrid()[role][screen];
  }

  savePermissions() {
    if (this.permsSaving()) return;
    this.permsSaving.set(true);
    this.permsSaveSuccess.set(false);
    this.permsError.set('');
    const grid = this.permGrid();
    const payload = {
      region_admin: this.gridToScreens(grid.region_admin),
      volunteer: this.gridToScreens(grid.volunteer),
      volunteer_manager: this.gridToScreens(grid.volunteer_manager),
      guest_manager: this.gridToScreens(grid.guest_manager),
      host_manager: this.gridToScreens(grid.host_manager),
    };
    this.svc.updatePermissions(payload).subscribe({
      next: (updated) => {
        this.permGrid.set({
          region_admin: this.screensToGrid(updated.region_admin),
          volunteer: this.screensToGrid(updated.volunteer),
          volunteer_manager: this.screensToGrid(updated.volunteer_manager),
          guest_manager: this.screensToGrid(updated.guest_manager),
          host_manager: this.screensToGrid(updated.host_manager),
        });
        this.permsSvc.reload();
        this.permsSaving.set(false);
        this.permsSaveSuccess.set(true);
        setTimeout(() => this.permsSaveSuccess.set(false), 3000);
      },
      error: () => {
        this.permsError.set('Error al guardar los permisos.');
        this.permsSaving.set(false);
      },
    });
  }

  private emptyGrid(): Record<ScreenKey, boolean> {
    return Object.fromEntries(this.screens.map((s) => [s.key, false])) as Record<
      ScreenKey,
      boolean
    >;
  }

  private screensToGrid(screens: string[]): Record<ScreenKey, boolean> {
    return Object.fromEntries(this.screens.map((s) => [s.key, screens.includes(s.key)])) as Record<
      ScreenKey,
      boolean
    >;
  }

  private gridToScreens(grid: Record<ScreenKey, boolean>): string[] {
    return this.screens.filter((s) => grid[s.key]).map((s) => s.key);
  }

  // ── Database backup ──────────────────────────────────────────────────

  readonly dbExporting = signal(false);
  readonly dbExportError = signal('');
  readonly dbImporting = signal(false);
  readonly dbImportError = signal('');
  readonly dbImportResult = signal<DatabaseImportResult | null>(null);

  exportDatabase() {
    if (this.dbExporting()) return;
    this.dbExporting.set(true);
    this.dbExportError.set('');
    this.svc.exportDatabase().subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const date = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = `roller-backup-${date}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.dbExporting.set(false);
      },
      error: () => {
        this.dbExportError.set('Error al exportar la base de datos.');
        this.dbExporting.set(false);
      },
    });
  }

  onImportFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.dbImporting()) return;

    if (
      !confirm(
        'Esto sustituirá TODOS los datos actuales por los del archivo importado. ' +
          'Esta acción no se puede deshacer. ¿Deseas continuar?',
      )
    ) {
      return;
    }

    this.dbImporting.set(true);
    this.dbImportError.set('');
    this.dbImportResult.set(null);
    this.svc.importDatabase(file).subscribe({
      next: (result) => {
        this.dbImportResult.set(result);
        this.dbImporting.set(false);
      },
      error: () => {
        this.dbImportError.set(
          'Error al importar la base de datos. Comprueba que el archivo es una copia de seguridad válida.',
        );
        this.dbImporting.set(false);
      },
    });
  }

  logoutAfterImport() {
    this.authSvc.logout();
  }
}
