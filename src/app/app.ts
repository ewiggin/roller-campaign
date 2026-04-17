import { Component } from '@angular/core';
import { GuestFormComponent } from './components/guest-form/guest-form.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [GuestFormComponent],
  template: `<app-guest-form />`,
})
export class App {}
