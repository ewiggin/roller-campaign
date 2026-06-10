import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type {
  Cart,
  CreateCartDto,
  UpdateCartDto,
  ImportCartRow,
  ImportCartParseResponse,
  ImportCartCommitResponse,
} from '../models/cart.model';

@Injectable({ providedIn: 'root' })
export class CartsService {
  private readonly http = inject(HttpClient);

  getAll(): Observable<Cart[]> {
    return this.http.get<Cart[]>('/api/carts');
  }

  getOne(id: string): Observable<Cart> {
    return this.http.get<Cart>(`/api/carts/${id}`);
  }

  create(dto: CreateCartDto): Observable<Cart> {
    return this.http.post<Cart>('/api/carts', dto);
  }

  update(id: string, dto: UpdateCartDto): Observable<Cart> {
    return this.http.patch<Cart>(`/api/carts/${id}`, dto);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`/api/carts/${id}`);
  }

  exportExcel(): Observable<Blob> {
    return this.http.get('/api/carts/export', { responseType: 'blob' });
  }

  downloadTemplate(): Observable<Blob> {
    return this.http.get('/api/carts/import/template', { responseType: 'blob' });
  }

  parseImport(file: File): Observable<ImportCartParseResponse> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<ImportCartParseResponse>('/api/carts/import/parse', form);
  }

  commitImport(rows: ImportCartRow[]): Observable<ImportCartCommitResponse> {
    return this.http.post<ImportCartCommitResponse>('/api/carts/import/commit', { rows });
  }
}
