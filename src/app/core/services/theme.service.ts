import { Injectable, signal, effect, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  private stored = localStorage.getItem('theme');
  private prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  readonly isDark = signal<boolean>(
    this.stored ? this.stored === 'dark' : this.prefersDark,
  );

  constructor() {
    effect(() => {
      const dark = this.isDark();
      this.document.documentElement.classList.toggle('dark', dark);
      localStorage.setItem('theme', dark ? 'dark' : 'light');
    });
    this.document.documentElement.classList.toggle('dark', this.isDark());
  }

  toggle() {
    this.isDark.update((v) => !v);
  }
}
