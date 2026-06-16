import { API_BASE_URL } from '../constants/api';
import { apiClient } from './client';

export type AdminStats = {
  toplam_kullanici: number;
  toplam_ilan: number;
  toplam_yorum: number;
};

type AdminUserResponse = {
  id: number;
  ad: string;
  soyad: string;
  eposta: string;
  is_admin: boolean;
  mahalle_id: number;
  mahalle?: {
    id: number;
    ad: string;
    sehir: string;
    ilce_id?: number | null;
  } | null;
  profil_resmi: string | null;
};

export type AdminUser = {
  id: number;
  ad: string;
  soyad: string;
  eposta: string;
  is_admin: boolean;
  mahalle_id: number;
  mahalle?: {
    id: number;
    ad: string;
    sehir: string;
    ilce_id?: number | null;
  } | null;
  profil_resmi: string | null;
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

export async function getAdminStats(mahalleId?: number) {
  const response = await apiClient.get<AdminStats>('/admin/stats', {
    params: mahalleId ? { mahalle_id: mahalleId } : undefined,
  });
  return response.data;
}

export async function getAdminUsers(params: { mahalleId?: number; q?: string }) {
  const response = await apiClient.get<AdminUserResponse[]>('/admin/users', {
    params: {
      ...(params.mahalleId ? { mahalle_id: params.mahalleId } : {}),
      ...(params.q?.trim() ? { q: params.q.trim() } : {}),
    },
  });

  return response.data.map((user) => ({
    ...user,
    profil_resmi: resolveProfileImageUrl(user.profil_resmi),
  })) satisfies AdminUser[];
}

export async function deleteAdminUser(userId: number) {
  const response = await apiClient.delete<{ mesaj: string }>(`/admin/users/${userId}`);
  return response.data;
}

export async function deleteAdminAd(adId: number) {
  const response = await apiClient.delete<{ mesaj: string }>(`/admin/ilanlar/${adId}`);
  return response.data;
}
