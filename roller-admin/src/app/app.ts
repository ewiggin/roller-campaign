import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';
import { ToastContainerComponent } from './shared/components/toast-container/toast-container';
import { ConfirmDialogComponent } from './shared/components/confirm-dialog/confirm-dialog';
import { VersionCheckService } from './core/services/version-check.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastContainerComponent, ConfirmDialogComponent],
  template: `
    <router-outlet />
    <app-toast-container />
    <app-confirm-dialog />
  `,
})
export class App {
  constructor() {
    inject(ThemeService);
    inject(VersionCheckService).start();
  }
}
