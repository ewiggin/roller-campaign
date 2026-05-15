import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, take } from 'rxjs';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
})
export class App {
  readonly loading = signal(true);

  constructor() {
    inject(ThemeService);
    inject(Router)
      .events.pipe(
        filter((e) => e instanceof NavigationEnd),
        take(1),
      )
      .subscribe(() => this.loading.set(false));
  }
}
