import { API_BASE_URL } from '../constants/api';
import { AdItem } from './ads';
import { apiClient } from './client';

type MahalleResponse = {
  id: number;
  ad: string;
  sehir: string;
};

type CurrentUserResponse = {
  id: number;
  ad: string;
  soyad: string;
  eposta: string;
  is_admin: boolean;
  mahalle_id: number;
  mahalle: MahalleResponse | null;
  profil_resmi: string | null;
  is_verified: boolean;
};

function normalizeCurrentUser(response: CurrentUserResponse) {
  return {
    id: response.id,
    ad: response.ad,
    soyad: response.soyad,
    eposta: response.eposta,
    is_admin: response.is_admin,
    mahalle_id: response.mahalle_id,
    mahalle: response.mahalle,
    profile_image: resolveProfileImageUrl(response.profil_resmi),
    is_verified: response.is_verified,
  } satisfies CurrentUser;
}

export type CurrentUser = {
  id: number;
  ad: string;
  soyad: string;
  eposta: string;
  is_admin: boolean;
  mahalle_id: number;
  mahalle: MahalleResponse | null;
  profile_image: string | null;
  is_verified: boolean;
};

export type UpdateCurrentUserPayload = {
  ad: string;
  soyad: string;
  eposta: string;
};

export type ChangePasswordPayload = {
  eski_sifre: string;
  yeni_sifre: string;
};

type UploadProfileImagePayload = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

function resolveProfileImageUrl(path: string | null) {
  if (!path) {
    return null;
  }

  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  const normalizedBaseUrl = API_BASE_URL.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBaseUrl}${normalizedPath}`;
}

function normalizeAdMedia(ad: AdItem) {
  return {
    ...ad,
    sahibi: ad.sahibi
      ? {
        ...ad.sahibi,
        profil_resmi: ad.sahibi.profil_resmi ? resolveProfileImageUrl(ad.sahibi.profil_resmi) : null,
      }
      : ad.sahibi,
    medyalar: ad.medyalar?.map((media) => ({
      ...media,
      dosya_yolu: media.dosya_yolu
        ? media.dosya_yolu.startsWith('http://') || media.dosya_yolu.startsWith('https://')
          ? media.dosya_yolu
          : `${API_BASE_URL.replace(/\/$/, '')}${media.dosya_yolu.startsWith('/') ? media.dosya_yolu : `/${media.dosya_yolu}`}`
        : media.dosya_yolu,
    })),
  } satisfies AdItem;
}

export async function getCurrentUser() {
  const response = await apiClient.get<CurrentUserResponse>('/kullanicilar/me');
  return normalizeCurrentUser(response.data);
}

export async function updateCurrentUser(payload: UpdateCurrentUserPayload) {
  const response = await apiClient.put<CurrentUserResponse>('/kullanicilar/me', payload);
  return normalizeCurrentUser(response.data);
}

export async function uploadProfileImage(payload: UploadProfileImagePayload) {
  const formData = new FormData();
  const fileName = payload.fileName || `profile-${Date.now()}.jpg`;
  const mimeType = payload.mimeType || 'image/jpeg';

  formData.append('file', {
    uri: payload.uri,
    name: fileName,
    type: mimeType,
  } as any);

  const response = await apiClient.post<CurrentUserResponse>('/kullanicilar/me/profil-resmi-yukle', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return normalizeCurrentUser(response.data);
}

export async function removeProfileImage() {
  const response = await apiClient.delete<CurrentUserResponse>('/kullanicilar/me/profil-resmi');
  return normalizeCurrentUser(response.data);
}

export async function getFavoriteAds() {
  const response = await apiClient.get<AdItem[]>('/kullanicilar/me/favoriler');
  return response.data.map(normalizeAdMedia);
}

export async function getMyAds() {
  const response = await apiClient.get<AdItem[]>('/kullanicilar/me/ilanlar');
  return response.data.map(normalizeAdMedia);
}

export async function changePassword(payload: ChangePasswordPayload) {
  const response = await apiClient.put<{ mesaj: string }>('/kullanicilar/me/sifre', payload);
  return response.data;
}
