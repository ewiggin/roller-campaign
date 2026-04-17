import { Component } from '@angular/core';
import { VolunteerFormComponent } from './components/volunteer-form/volunteer-form.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [VolunteerFormComponent],
  template: `<app-volunteer-form />`,
})
export class App {}
