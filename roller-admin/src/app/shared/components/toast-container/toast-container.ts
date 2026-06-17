import { Component, inject } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast-container',
  template: `
    <div class="fixed top-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm pointer-events-none">
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg"
          [class]="toast.type === 'info'
            ? 'border-blue-200 dark:border-blue-900/50 bg-white dark:bg-[#27272a] text-blue-700 dark:text-blue-300'
            : 'border-red-200 dark:border-red-900/50 bg-white dark:bg-[#27272a] text-red-700 dark:text-red-300'"
        >
          <p class="flex-1">{{ toast.message }}</p>
          <button
            type="button"
            (click)="toastService.dismiss(toast.id)"
            aria-label="Cerrar"
            [class]="toast.type === 'info'
              ? 'leading-none text-blue-400 hover:text-blue-600 dark:hover:text-blue-200'
              : 'leading-none text-red-400 hover:text-red-600 dark:hover:text-red-200'"
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
