import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
  type: 'error' | 'info';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;

  readonly toasts = signal<Toast[]>([]);

  show(message: string, type: Toast['type'] = 'error') {
    const id = ++this.nextId;
    this.toasts.update((list) => [...list, { id, message, type }]);
  }

  dismiss(id: number) {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
