import { Component, ElementRef, HostListener, input, signal } from '@angular/core';

export interface MenuItem {
  label: string;
  action: () => void;
  disabled?: boolean;
}

@Component({
  selector: 'app-menu-button',
  templateUrl: './menu-button.html',
})
export class MenuButtonComponent {
  readonly label = input<string>('Acciones');
  readonly items = input<MenuItem[]>([]);
  readonly variant = input<'default' | 'danger'>('default');

  protected readonly open = signal(false);

  constructor(private readonly el: ElementRef) {}

  protected toggle() {
    this.open.update((v) => !v);
  }

  protected run(item: MenuItem) {
    if (item.disabled) return;
    this.open.set(false);
    item.action();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.el.nativeElement.contains(event.target)) {
      this.open.set(false);
    }
  }
}
