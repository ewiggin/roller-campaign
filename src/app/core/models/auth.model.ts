export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: 'superadmin' | 'region_admin' | 'volunteer' | 'guest';
  iat: number;
  exp: number;
}
