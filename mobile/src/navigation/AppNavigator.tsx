import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useIsFocused } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { getInboxConversations } from '../api/messages';
import { HomeScreen } from '../screens/home/HomeScreen';
import { MessagesScreen } from '../screens/messages/MessagesScreen';
import { ChangePasswordScreen } from '../screens/profile/ChangePasswordScreen';
import { AdminIlansScreen } from '../screens/profile/AdminIlansScreen';
import { AdminPanelScreen } from '../screens/profile/AdminPanelScreen';
import { AdminUserDetailScreen } from '../screens/profile/AdminUserDetailScreen';
import { AdminUsersScreen } from '../screens/profile/AdminUsersScreen';
import { EditProfileScreen } from '../screens/profile/EditProfileScreen';
import { FavoritesScreen } from '../screens/profile/FavoritesScreen';
import { MyAdsScreen } from '../screens/profile/MyAdsScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { AdDetailScreen } from '../screens/ads/AdDetailScreen';
import { AllAdsScreen } from '../screens/ads/AllAdsScreen';
import { CommentsScreen } from '../screens/ads/CommentsScreen';
import { IlanOlusturScreen } from '../screens/ads/IlanOlusturScreen';
import { ChatScreen } from '../screens/messages/ChatScreen';
import { AppStackParamList, AppTabParamList } from './types';
import { APP_COLORS } from '../../theme/appColor';
import { messageSocket } from '../services/messageSocket';

const Tab = createBottomTabNavigator<AppTabParamList>();
const Stack = createNativeStackNavigator<AppStackParamList>();

function AppTabs() {
  const isFocused = useIsFocused();
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);

  const loadUnreadMessageCount = async () => {
    try {
      const inboxItems = await getInboxConversations();
      setUnreadMessageCount(inboxItems.reduce((total, item) => total + item.okunmamis_sayisi, 0));
    } catch {
      setUnreadMessageCount(0);
    }
  };

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    loadUnreadMessageCount();
  }, [isFocused]);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    const unsubscribe = messageSocket.subscribe((event) => {
      if (event.type !== 'message:new') {
        return;
      }

      void loadUnreadMessageCount();
    });

    return unsubscribe;
  }, [isFocused]);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: APP_COLORS.secondary,
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          height: 74,
          paddingTop: 6,
          paddingBottom: 10,
          backgroundColor: '#ffffff',
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontFamily: 'Georgia',
          fontWeight: 'bold',
        },
        tabBarIcon: ({ color, size }) => {
          if (route.name === 'Home') {
            return <Ionicons name="home-outline" size={size} color={color} />;
          }

          if (route.name === 'Messages') {
            return <Ionicons name="chatbubble-ellipses-outline" size={size} color={color} />;
          }

          return <Ionicons name="person-outline" size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Ana Sayfa' }} />
      <Tab.Screen
        name="Messages"
        component={MessagesScreen}
        options={{
          tabBarLabel: 'Mesajlar',
          tabBarBadge: unreadMessageCount > 0 ? (unreadMessageCount > 99 ? '99+' : unreadMessageCount) : undefined,
        }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: 'Profil' }} />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Tabs" component={AppTabs} options={{ headerShown: false }} />
      <Stack.Screen
        name="IlanOlustur"
        component={IlanOlusturScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AllAds"
        component={AllAdsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AdminPanel"
        component={AdminPanelScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AdminUsers"
        component={AdminUsersScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AdminIlans"
        component={AdminIlansScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AdminUserDetail"
        component={AdminUserDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Favorites"
        component={FavoritesScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="MyAds"
        component={MyAdsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AdDetail"
        component={AdDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Comments"
        component={CommentsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
