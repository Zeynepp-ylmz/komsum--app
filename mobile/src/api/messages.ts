import { apiClient } from './client';
import { API_BASE_URL } from '../constants/api';

export type MessageItem = {
  id: number;
  metin: string;
  tarih: string;
  gonderen_id: number;
  alici_id: number;
  ilan_id?: number | null;
  okundu: boolean;
};

export type SendMessagePayload = {
  metin: string;
  alici_id: number;
  ilan_id?: number;
};

export type InboxConversationItem = {
  karsi_taraf_id: number;
  karsi_taraf_ad: string;
  karsi_taraf_soyad: string;
  karsi_taraf_profil_resmi?: string | null;
  ilan_id?: number | null;
  ilan_baslik?: string | null;
  son_mesaj: string;
  son_mesaj_tarihi: string;
  okunmamis_sayisi: number;
};

function resolveProfileImageUrl(path?: string | null) {
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

function normalizeInboxConversation(item: InboxConversationItem) {
  return {
    ...item,
    karsi_taraf_profil_resmi: resolveProfileImageUrl(item.karsi_taraf_profil_resmi),
  } satisfies InboxConversationItem;
}

export async function getConversation(karsiTarafId: number) {
  const response = await apiClient.get<MessageItem[]>(`/mesajlarim/sohbet/${karsiTarafId}`);
  return response.data;
}

export async function getInboxConversations() {
  const response = await apiClient.get<InboxConversationItem[]>('/mesajlarim/kutu');
  return response.data.map(normalizeInboxConversation);
}

export async function sendMessage(payload: SendMessagePayload) {
  const response = await apiClient.post<{ mesaj: string }>('/mesajlar/', payload);
  return response.data;
}

export async function markConversationAsRead(karsiTarafId: number, ilanId?: number) {
  const response = await apiClient.post<{ mesaj: string }>('/mesajlar/okundu-yap', null, {
    params: {
      karsi_taraf_id: karsiTarafId,
      ...(ilanId ? { ilan_id: ilanId } : {}),
    },
  });

  return response.data;
}
