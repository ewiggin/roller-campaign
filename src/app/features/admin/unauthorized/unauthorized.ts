import { Component } from '@angular/core';

@Component({
  selector: 'app-unauthorized',
  template: `
    <div class="flex flex-col items-center justify-center h-full text-center px-6">
      <p class="text-4xl mb-4">🔒</p>
      <h1 class="text-lg font-semibold text-gray-800 dark:text-zinc-100 mb-2">Sin acceso</h1>
      <p class="text-sm text-gray-500 dark:text-zinc-400">
        Tu cuenta no tiene acceso a ninguna sección. Contacta con un administrador.
      </p>
    </div>
  `,
})
export class UnauthorizedComponent {}
