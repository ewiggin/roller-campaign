import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SettingsService } from '../../../core/services/settings.service';

@Component({
  selector: 'app-settings',
  imports: [ReactiveFormsModule],
  templateUrl: './settings.html',
})
export class SettingsComponent implements OnInit {
  private readonly svc = inject(SettingsService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly testing = signal(false);
  readonly saveSuccess = signal(false);
  readonly testSuccess = signal(false);
  readonly error = signal('');
  readonly testError = signal('');
  readonly testEmail = signal('');

  readonly form = this.fb.nonNullable.group({
    host: [''],
    port: [587, [Validators.min(1), Validators.max(65535)]],
    secure: [false],
    user: [''],
    password: [''],
    from_name: [''],
    from_email: [''],
    enabled: [false],
  });

  ngOnInit() {
    this.svc.getSmtp().subscribe({
      next: (s) => {
        this.form.patchValue({
          host: s.host ?? '',
          port: s.port ?? 587,
          secure: s.secure,
          user: s.user ?? '',
          from_name: s.from_name ?? '',
          from_email: s.from_email ?? '',
          enabled: s.enabled,
        });
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Error al cargar la configuración.');
        this.loading.set(false);
      },
    });
  }

  save() {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.saveSuccess.set(false);
    this.error.set('');

    const raw = this.form.getRawValue();
    const payload: Record<string, unknown> = { ...raw };
    if (!payload['password']) delete payload['password'];

    this.svc.updateSmtp(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.saveSuccess.set(true);
        this.form.get('password')!.reset('');
        setTimeout(() => this.saveSuccess.set(false), 3000);
      },
      error: () => {
        this.error.set('Error al guardar la configuración.');
        this.saving.set(false);
      },
    });
  }

  sendTest() {
    const to = this.testEmail();
    if (!to || this.testing()) return;
    this.testing.set(true);
    this.testSuccess.set(false);
    this.testError.set('');

    this.svc.testSmtp(to).subscribe({
      next: () => {
        this.testing.set(false);
        this.testSuccess.set(true);
        setTimeout(() => this.testSuccess.set(false), 5000);
      },
      error: () => {
        this.testError.set('Error al enviar el correo de prueba. Verifica la configuración SMTP.');
        this.testing.set(false);
      },
    });
  }

  updateTestEmail(value: string) {
    this.testEmail.set(value);
  }
}
