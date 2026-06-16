import axios, { AxiosError, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '../constants/api';
import { getAccessToken, getRefreshToken, setAccessToken } from '../services/tokenStorage';

type UnauthorizedHandler = () => Promise<void> | void;
type RetryableRequestConfig = InternalAxiosRequestConfig & { _retry?: boolean };

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

let unauthorizedHandler: UnauthorizedHandler | null = null;
let isHandlingUnauthorized = false;
let refreshTokenRequest: Promise<string | null> | null = null;

export function setAuthorizationToken(token: string | null) {
  if (token) {
    apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
    return;
  }

  delete apiClient.defaults.headers.common.Authorization;
}

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

async function handleUnauthorized() {
  if (!unauthorizedHandler || isHandlingUnauthorized) {
    return;
  }

  isHandlingUnauthorized = true;

  try {
    await unauthorizedHandler();
  } finally {
    isHandlingUnauthorized = false;
  }
}

async function refreshAccessToken() {
  if (refreshTokenRequest) {
    return refreshTokenRequest;
  }

  refreshTokenRequest = (async () => {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) {
      return null;
    }

    const response = await apiClient.post<{ access_token: string; token_type: string }>(
      '/auth/refresh',
      undefined,
      {
        params: { refresh_token: refreshToken },
      },
    );

    const nextAccessToken = response.data.access_token;
    await setAccessToken(nextAccessToken);
    setAuthorizationToken(nextAccessToken);
    return nextAccessToken;
  })();

  try {
    return await refreshTokenRequest;
  } finally {
    refreshTokenRequest = null;
  }
}

apiClient.interceptors.request.use(async (config) => {
  const existingAuthorizationHeader = config.headers?.Authorization || config.headers?.authorization;

  if (existingAuthorizationHeader) {
    return config;
  }

  const token = await getAccessToken();

  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const axiosError = error as AxiosError;
    const status = error.response?.status;
    const detail = error.response?.data?.detail;
    const originalRequest = axiosError.config as RetryableRequestConfig | undefined;
    const requestUrl = originalRequest?.url ?? '';
    const shouldResetSession =
      status === 401 &&
      (detail === 'Kimlik doğrulanamadı' || detail === 'Bu oturum sonlandırılmış. Lütfen tekrar giriş yapın.');

    const shouldTryRefresh =
      shouldResetSession &&
      originalRequest &&
      !originalRequest._retry &&
      requestUrl !== '/auth/refresh';

    if (shouldTryRefresh) {
      originalRequest._retry = true;

      try {
        const nextAccessToken = await refreshAccessToken();

        if (nextAccessToken) {
          const headers =
            originalRequest.headers instanceof AxiosHeaders
              ? originalRequest.headers
              : AxiosHeaders.from(originalRequest.headers ?? {});
          headers.set('Authorization', `Bearer ${nextAccessToken}`);
          originalRequest.headers = headers;

          return apiClient(originalRequest);
        }
      } catch {
        await handleUnauthorized();
        return Promise.reject(error);
      }
    }

    if (shouldResetSession) {
      await handleUnauthorized();
    }

    return Promise.reject(error);
  },
);
