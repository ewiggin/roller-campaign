import { Component, input } from '@angular/core';

@Component({
  selector: 'app-skeleton',
  template: `
    <div
      class="animate-pulse bg-gray-200 dark:bg-zinc-700 rounded"
      [class]="cls()"
    ></div>
  `,
})
export class SkeletonComponent {
  cls = input('h-4 w-full');
}
