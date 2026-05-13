import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { User, CreateUserPayload, UpdateUserPayload } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);

  getAll() {
    return this.http.get<User[]>('/api/users');
  }

  create(payload: CreateUserPayload) {
    return this.http.post<User>('/api/users', payload);
  }

  update(id: string, payload: UpdateUserPayload) {
    return this.http.patch<User>(`/api/users/${id}`, payload);
  }

  remove(id: string) {
    return this.http.delete<void>(`/api/users/${id}`);
  }
}
