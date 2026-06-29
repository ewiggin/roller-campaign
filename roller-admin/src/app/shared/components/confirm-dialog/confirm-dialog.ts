import { Component, HostListener, inject } from '@angular/core';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-confirm-dialog',
  template: `
    @if (svc.state()) {
      <div class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <div
          class="bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-gray-200 dark:border-zinc-700 w-full max-w-md"
          (click)="$event.stopPropagation()"
        >
          @if (svc.state()!.title) {
            <div class="px-6 pt-5 pb-1">
              <h3 class="text-base font-semibold text-gray-900 dark:text-zinc-100">
                {{ svc.state()!.title }}
              </h3>
            </div>
          }
          <div class="px-6 py-5">
            <p class="text-sm text-gray-600 dark:text-zinc-400">{{ svc.state()!.message }}</p>
          </div>
          <div class="flex justify-end gap-3 px-6 pb-5">
            <button
              type="button"
              (click)="svc.dismiss()"
              class="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 dark:text-zinc-300 border border-gray-300 dark:border-zinc-600 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              (click)="svc.accept()"
              class="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 transition-colors"
            >
              {{ svc.state()!.confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmDialogComponent {
  protected readonly svc = inject(ConfirmDialogService);

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.svc.state()) this.svc.dismiss();
  }
}
