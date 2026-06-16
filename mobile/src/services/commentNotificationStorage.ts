import AsyncStorage from '@react-native-async-storage/async-storage';

function getStorageKey(userId: number) {
  return `seen-comment-notification-ids:${userId}`;
}

export async function getSeenCommentNotificationIds(userId: number) {
  const rawValue = await AsyncStorage.getItem(getStorageKey(userId));

  if (!rawValue) {
    return [] as number[];
  }

  try {
    const parsedValue = JSON.parse(rawValue);
    return Array.isArray(parsedValue) ? parsedValue.filter((item) => typeof item === 'number') : [];
  } catch {
    return [];
  }
}

export async function setSeenCommentNotificationIds(userId: number, commentIds: number[]) {
  const uniqueIds = Array.from(new Set(commentIds));
  await AsyncStorage.setItem(getStorageKey(userId), JSON.stringify(uniqueIds));
}
