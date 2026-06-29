import { Injectable, signal } from '@angular/core';

export interface ConfirmState {
  message: string;
  title?: string;
  confirmLabel: string;
  resolve: (value: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  readonly state = signal<ConfirmState | null>(null);

  confirm(message: string, opts: { title?: string; confirmLabel?: string } = {}): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.state.set({
        message,
        title: opts.title,
        confirmLabel: opts.confirmLabel ?? 'Confirm',
        resolve,
      });
    });
  }

  accept() {
    this.state()?.resolve(true);
    this.state.set(null);
  }

  dismiss() {
    this.state()?.resolve(false);
    this.state.set(null);
  }
}
