import { Component, inject } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast-container',
  template: `
    <div class="fixed top-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm pointer-events-none">
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="pointer-events-auto flex items-start gap-3 rounded-lg border border-red-200 dark:border-red-900/50 bg-white dark:bg-[#27272a] px-4 py-3 text-sm text-red-700 dark:text-red-300 shadow-lg"
        >
          <p class="flex-1">{{ toast.message }}</p>
          <button
            type="button"
            (click)="toastService.dismiss(toast.id)"
            aria-label="Cerrar"
            class="leading-none text-red-400 hover:text-red-600 dark:hover:text-red-200"
          >
            ✕
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastContainerComponent {
  protected readonly toastService = inject(ToastService);
}
