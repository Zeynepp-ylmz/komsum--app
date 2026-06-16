import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { AppNavigator } from './AppNavigator';
import { AuthNavigator } from './AuthNavigator';
import { useAuth } from '../store/auth/AuthContext';
import { useEffect } from 'react';
import { messageSocket } from '../services/messageSocket';
import { flushPendingNavigation, navigationRef } from './navigationService';
import { handleInitialNotificationResponse, registerNotificationResponseListener } from '../services/pushNotifications';

export function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      messageSocket.activate();
      return;
    }

    messageSocket.deactivate();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const unsubscribe = registerNotificationResponseListener();
    void handleInitialNotificationResponse();

    return unsubscribe;
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={flushPendingNavigation}
    >
      {isAuthenticated ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
