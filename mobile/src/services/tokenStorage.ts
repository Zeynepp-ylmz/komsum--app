import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCESS_TOKEN_KEY = 'komsum_access_token';
const REFRESH_TOKEN_KEY = 'komsum_refresh_token';
let accessTokenCache: string | null = null;
let refreshTokenCache: string | null = null;
const accessTokenListeners = new Set<(token: string | null) => void>();

function notifyAccessTokenListeners(token: string | null) {
  for (const listener of accessTokenListeners) {
    listener(token);
  }
}

async function persistAccessToken(accessToken: string | null) {
  accessTokenCache = accessToken;

  if (accessToken) {
    await AsyncStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  } else {
    await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
  }

  notifyAccessTokenListeners(accessToken);
}

export async function setTokens(accessToken: string, refreshToken?: string | null) {
  refreshTokenCache = refreshToken ?? null;
  await persistAccessToken(accessToken);

  if (refreshToken) {
    await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  } else {
    await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

export async function setAccessToken(accessToken: string | null) {
  await persistAccessToken(accessToken);
}

export async function getAccessToken() {
  if (accessTokenCache !== null) {
    return accessTokenCache;
  }

  accessTokenCache = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
  return accessTokenCache;
}

export async function getRefreshToken() {
  if (refreshTokenCache !== null) {
    return refreshTokenCache;
  }

  refreshTokenCache = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
  return refreshTokenCache;
}

export async function clearTokens() {
  refreshTokenCache = null;
  await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
  await persistAccessToken(null);
}

export function subscribeToAccessTokenChanges(listener: (token: string | null) => void) {
  accessTokenListeners.add(listener);

  return () => {
    accessTokenListeners.delete(listener);
  };
}
