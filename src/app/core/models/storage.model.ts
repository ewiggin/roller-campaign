export interface PresignUploadRequest {
  key: string;
  contentType: string;
  expiresIn?: number;
}

export interface PresignUploadResponse {
  url: string;
  key: string;
  expiresIn: number;
}

export interface PresignDownloadResponse {
  url: string;
  key: string;
  expiresIn: number;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}
