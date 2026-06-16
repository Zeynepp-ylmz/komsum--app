import { apiClient } from './client';

export type LoginPayload = {
  email: string;
  password: string;
};

export type RegisterPayload = {
  ad: string;
  soyad: string;
  eposta: string;
  password: string;
  mahalle_id: number;
};

export type AuthResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

export async function login(payload: LoginPayload) {
  const body = new URLSearchParams();
  body.append('username', payload.email);
  body.append('password', payload.password);

  const response = await apiClient.post<AuthResponse>('/auth/login', body.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  return response.data;
}

export async function register(payload: RegisterPayload) {
  const response = await apiClient.post('/auth/register', payload);
  return response.data;
}

export async function forgotPassword(eposta: string) {
  const response = await apiClient.post('/auth/forgot-password', null, {
    params: { eposta },
  });

  return response.data;
}
