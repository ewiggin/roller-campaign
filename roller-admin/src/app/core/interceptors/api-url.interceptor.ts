import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export const apiUrlInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url.startsWith('/api/') || req.url === '/api') {
    return next(req.clone({ url: environment.apiUrl + req.url.slice(4) }));
  }
  return next(req);
};
