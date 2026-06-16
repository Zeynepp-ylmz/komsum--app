import { createNavigationContainerRef } from '@react-navigation/native';

import { AppStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<AppStackParamList>();

let pendingChatParams: AppStackParamList['Chat'] | null = null;

export function navigateToChatFromNotification(params: AppStackParamList['Chat']) {
  if (navigationRef.isReady()) {
    navigationRef.navigate('Chat', params);
    return;
  }

  pendingChatParams = params;
}

export function flushPendingNavigation() {
  if (!pendingChatParams || !navigationRef.isReady()) {
    return;
  }

  navigationRef.navigate('Chat', pendingChatParams);
  pendingChatParams = null;
}
