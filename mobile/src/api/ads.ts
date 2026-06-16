import { API_BASE_URL } from '../constants/api';
import { apiClient } from './client';

export type AdItem = {
  id: number;
  baslik: string;
  aciklama: string;
  fiyat: number;
  tarih: string;
  medyalar?: {
    id?: number;
    dosya_yolu: string;
    tip: string;
  }[];
  kategori?: {
    id: number;
    ad: string;
  } | null;
  sahibi?: {
    id: number;
    ad: string;
    soyad: string;
    mahalle?: {
      id: number;
      ad: string;
      sehir: string;
    } | null;
    profil_resmi?: string | null;
  } | null;
  etiketler?: {
    id: number;
    ad: string;
  }[];
};

export type GetAdsParams = {
  q?: string;
  etiket_arama?: string;
  kategori_id?: number;
  min_fiyat?: number;
  max_fiyat?: number;
  son_kac_gun?: number;
};

export type CategoryItem = {
  id: number;
  ad: string;
};

export type CreateAdPayload = {
  baslik: string;
  aciklama: string;
  fiyat?: number;
  kategori_id: number;
  etiketler?: string[];
  files?: {
    uri: string;
    name: string;
    type: string;
  }[];
};

export type UpdateAdPayload = {
  adId: number;
  baslik?: string;
  aciklama?: string;
  fiyat?: number;
  kategori_id?: number;
  etiketler?: string[];
  silinecek_medya_ids?: number[];
  files?: {
    uri: string;
    name: string;
    type: string;
  }[];
};

export type ToggleFavoriteResponse = {
  mesaj: string;
  durum: 'eklendi' | 'cikarildi';
};

function resolveMediaUrl(path: string) {
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
        profil_resmi: ad.sahibi.profil_resmi ? resolveMediaUrl(ad.sahibi.profil_resmi) : null,
      }
      : ad.sahibi,
    medyalar: ad.medyalar?.map((media) => ({
      ...media,
      dosya_yolu: resolveMediaUrl(media.dosya_yolu),
    })),
  } satisfies AdItem;
}

export async function getAds(params?: GetAdsParams) {
  const response = await apiClient.get<AdItem[]>('/ilanlar/', {
    params,
  });
  return response.data.map(normalizeAdMedia);
}

export async function getCategories() {
  const response = await apiClient.get<CategoryItem[]>('/kategoriler/');
  return response.data;
}

export async function getAdById(adId: number) {
  const response = await apiClient.get<AdItem>(`/ilanlar/${adId}`);
  return normalizeAdMedia(response.data);
}

export async function createAd(payload: CreateAdPayload) {
  const formData = new FormData();
  formData.append('baslik', payload.baslik);
  formData.append('aciklama', payload.aciklama);
  formData.append('fiyat', String(payload.fiyat ?? 0));
  formData.append('kategori_id', String(payload.kategori_id));

  for (const etiket of payload.etiketler ?? []) {
    formData.append('etiketler', etiket);
  }

  for (const file of payload.files ?? []) {
    formData.append('files', file as any);
  }

  const response = await apiClient.post('/ilanlar/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
}

export async function updateAd(payload: UpdateAdPayload) {
  const formData = new FormData();

  if (payload.baslik !== undefined) {
    formData.append('baslik', payload.baslik);
  }

  if (payload.aciklama !== undefined) {
    formData.append('aciklama', payload.aciklama);
  }

  if (payload.fiyat !== undefined) {
    formData.append('fiyat', String(payload.fiyat));
  }

  if (payload.kategori_id !== undefined) {
    formData.append('kategori_id', String(payload.kategori_id));
  }

  for (const etiket of payload.etiketler ?? []) {
    formData.append('etiketler', etiket);
  }

  for (const medyaId of payload.silinecek_medya_ids ?? []) {
    formData.append('silinecek_medya_ids', String(medyaId));
  }

  for (const file of payload.files ?? []) {
    formData.append('files', file as any);
  }

  const response = await apiClient.put<AdItem>(`/ilanlar/${payload.adId}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return normalizeAdMedia(response.data);
}

export async function toggleAdFavorite(adId: number) {
  const response = await apiClient.post<ToggleFavoriteResponse>(`/ilanlar/${adId}/favorile`);
  return response.data;
}

export async function deleteAd(adId: number) {
  const response = await apiClient.delete<{ mesaj: string }>(`/ilanlar/${adId}`);
  return response.data;
}
