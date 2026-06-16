import { API_BASE_URL } from '../constants/api';
import { apiClient } from './client';

export type CommentItem = {
  id: number;
  icerik: string;
  puan: number;
  tarih: string;
  yazan_kullanici_id: number;
  yazan_ad?: string | null;
  yazan_soyad?: string | null;
  yazan_profil_resmi?: string | null;
  yazan_guven_duzeyi?: number | null;
};

export type CreateCommentPayload = {
  icerik: string;
  puan: number;
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

function normalizeComment(comment: CommentItem) {
  return {
    ...comment,
    yazan_profil_resmi: resolveProfileImageUrl(comment.yazan_profil_resmi),
  } satisfies CommentItem;
}

export async function getComments(adId: number) {
  const response = await apiClient.get<CommentItem[]>(`/ilanlar/${adId}/yorumlar`);
  return response.data.map(normalizeComment);
}

export async function createComment(adId: number, payload: CreateCommentPayload) {
  const response = await apiClient.post<{ mesaj: string; yorum_id: number }>(`/ilanlar/${adId}/yorumlar`, payload);
  return response.data;
}

export async function deleteComment(commentId: number) {
  const response = await apiClient.delete<{ mesaj: string }>(`/yorumlar/${commentId}`);
  return response.data;
}
