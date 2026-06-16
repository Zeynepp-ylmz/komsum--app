import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import type { Notification } from 'expo-notifications';
import { Platform } from 'react-native';

import { apiClient } from '../api/client';
import { navigateToChatFromNotification } from '../navigation/navigationService';

let hasAttemptedPushRegistration = false;
let notificationResponseSubscription: { remove: () => void } | null = null;

function getExpoProjectId() {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    undefined
  );
}

export function resetPushNotificationRegistration() {
  hasAttemptedPushRegistration = false;
}

function handleNotificationNavigation(notification: Notification) {
  const data = notification.request.content.data;
  const senderId =
    typeof data?.sender_id === 'number'
      ? data.sender_id
      : typeof data?.sender_id === 'string'
        ? Number(data.sender_id)
        : NaN;

  if (!data || data.type !== 'message' || Number.isNaN(senderId)) {
    return;
  }

  navigateToChatFromNotification({
    aliciId: senderId,
  });
}

export async function handleInitialNotificationResponse() {
  const response = await Notifications.getLastNotificationResponseAsync();
  if (!response) {
    return;
  }

  handleNotificationNavigation(response.notification);
}

export function registerNotificationResponseListener() {
  if (notificationResponseSubscription) {
    return () => {};
  }

  notificationResponseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    handleNotificationNavigation(response.notification);
  });

  return () => {
    notificationResponseSubscription?.remove();
    notificationResponseSubscription = null;
  };
}

export async function registerPushNotifications() {
  if (hasAttemptedPushRegistration) {
    return;
  }

  hasAttemptedPushRegistration = true;

  if (!Device.isDevice) {
    return;
  }

  try {
    const existingPermissions = await Notifications.getPermissionsAsync();
    let finalStatus = existingPermissions.status;

    if (finalStatus !== 'granted') {
      const requestedPermissions = await Notifications.requestPermissionsAsync();
      finalStatus = requestedPermissions.status;
    }

    if (finalStatus !== 'granted') {
      return;
    }

    const projectId = getExpoProjectId();
    const expoPushToken = projectId
      ? (await Notifications.getExpoPushTokenAsync({ projectId })).data
      : (await Notifications.getExpoPushTokenAsync()).data;

    if (!expoPushToken) {
      return;
    }

    await apiClient.post('/notifications/push-token', {
      expo_push_token: expoPushToken,
      platform: Platform.OS,
    });
  } catch (error) {
    console.warn('Push notification token alinamadi:', error);
  }
}
