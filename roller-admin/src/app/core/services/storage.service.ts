import {
  HttpBackend,
  HttpClient,
  HttpEventType,
  HttpHeaders,
  HttpParams,
  HttpRequest,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, filter, map, switchMap } from 'rxjs';
import type {
  PresignDownloadResponse,
  PresignUploadResponse,
  UploadProgress,
} from '../models/storage.model';

@Injectable({ providedIn: 'root' })
export class StorageService {
  // Uses the regular HttpClient (goes through interceptors) only for /api calls.
  private readonly http = inject(HttpClient);

  // Bypass all interceptors for direct bucket requests. S3 presigned URLs embed
  // auth in the query string — adding an Authorization header breaks the signature.
  private readonly directHttp = new HttpClient(inject(HttpBackend));

  // ── Presign endpoints ─────────────────────────────────────────────────────

  getUploadPresignedUrl(
    key: string,
    contentType: string,
    expiresIn?: number,
  ): Observable<PresignUploadResponse> {
    return this.http.post<PresignUploadResponse>('/api/storage/presign/upload', {
      key,
      contentType,
      ...(expiresIn !== undefined && { expiresIn }),
    });
  }

  getDownloadPresignedUrl(key: string, expiresIn?: number): Observable<PresignDownloadResponse> {
    let params = new HttpParams().set('key', key);
    if (expiresIn !== undefined) params = params.set('expiresIn', expiresIn);
    return this.http.get<PresignDownloadResponse>('/api/storage/presign/download', {
      params,
    });
  }

  // ── Direct bucket operations ──────────────────────────────────────────────

  /**
   * Upload a file directly to the bucket via a presigned PUT URL.
   * Emits UploadProgress events while in flight, then completes.
   */
  upload(presignedUrl: string, file: File): Observable<UploadProgress> {
    const req = new HttpRequest('PUT', presignedUrl, file, {
      headers: new HttpHeaders({ 'Content-Type': file.type }),
      reportProgress: true,
    });

    return this.directHttp.request(req).pipe(
      filter(
        (event) =>
          event.type === HttpEventType.UploadProgress || event.type === HttpEventType.Response,
      ),
      map((event) => {
        if (event.type === HttpEventType.UploadProgress) {
          const total = event.total ?? 0;
          const loaded = event.loaded;
          return { loaded, total, percent: total ? Math.round((loaded / total) * 100) : 0 };
        }
        return { loaded: file.size, total: file.size, percent: 100 };
      }),
    );
  }

  /**
   * Convenience: obtain a presigned URL then upload in one call.
   * Returns the final storage key so callers can persist it.
   */
  uploadFile(
    key: string,
    file: File,
    expiresIn?: number,
  ): Observable<{ key: string; progress: UploadProgress }> {
    return this.getUploadPresignedUrl(key, file.type || 'application/octet-stream', expiresIn).pipe(
      switchMap((presign) =>
        this.upload(presign.url, file).pipe(map((progress) => ({ key: presign.key, progress }))),
      ),
    );
  }

  /**
   * Obtain a presigned GET URL and trigger a browser download.
   */
  downloadFile(key: string, filename: string, expiresIn?: number): Observable<void> {
    return this.getDownloadPresignedUrl(key, expiresIn).pipe(
      map(({ url }) => {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.rel = 'noopener';
        anchor.click();
      }),
    );
  }

  // ── Key helpers ───────────────────────────────────────────────────────────

  /**
   * Build a collision-safe object key.
   * Example: buildKey('volunteers/photos', 'mario.jpg') → 'volunteers/photos/1749123456789-mario.jpg'
   */
  buildKey(folder: string, filename: string): string {
    const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `${folder}/${Date.now()}-${sanitized}`;
  }
}
