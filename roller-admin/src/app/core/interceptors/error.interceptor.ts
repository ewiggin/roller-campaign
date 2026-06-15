import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../services/toast.service';

/**
 * Surfaces API errors as a dismissible toast. 401s are skipped: the auth
 * interceptor already redirects to /login for those, so a toast would just
 * flash and disappear.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401) {
        toast.show(extractMessage(error));
      }
      return throwError(() => error);
    }),
  );
};

function extractMessage(error: HttpErrorResponse): string {
  if (error.status === 0) {
    return 'No se puede conectar con el servidor.';
  }
  const message: unknown = error.error?.message;
  if (Array.isArray(message)) return message.join(', ');
  if (typeof message === 'string') return message;
  return `Error ${error.status}: ${error.statusText || 'ha ocurrido un error inesperado.'}`;
}
