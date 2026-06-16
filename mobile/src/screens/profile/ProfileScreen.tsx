import { Ionicons } from '@expo/vector-icons';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { APP_COLORS } from '../../../theme/appColor';
import { CurrentUser, getCurrentUser } from '../../api/users';
import { AppStackParamList } from '../../navigation/types';
import { useAuth } from '../../store/auth/AuthContext';

const profileMenuItems = [
  {
    key: 'my-ads',
    title: 'Benim İlanlarım',
    icon: 'pricetags-outline' as const,
    iconBackgroundColor: '#fff1db',
    iconColor: '#d97706',
  },
  {
    key: 'favorites',
    title: 'Favorilerim',
    icon: 'heart-outline' as const,
    iconBackgroundColor: '#fde2e2',
    iconColor: '#dc2626',
  },
  {
    key: 'change-password',
    title: 'Şifre Değiştir',
    icon: 'lock-closed-outline' as const,
    iconBackgroundColor: '#ece8ff',
    iconColor: '#6d28d9',
  },
];

export function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { logout } = useAuth();
  const isFocused = useIsFocused();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.detail || 'Profil bilgileri yüklenemedi.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    loadProfile();
  }, [isFocused]);

  if (isLoading) {
    return (
      <View style={styles.centeredState}>
        <ActivityIndicator size="large" color={APP_COLORS.secondary} />
        <Text style={styles.stateText}>Profil yükleniyor...</Text>
      </View>
    );
  }

  if (errorMessage) {
    return (
      <View style={styles.centeredState}>
        <Ionicons name="alert-circle-outline" size={36} color="#b91c1c" />
        <Text style={styles.errorText}>{errorMessage}</Text>
        <Pressable style={styles.retryButton} onPress={loadProfile}>
          <Text style={styles.retryButtonText}>Tekrar Dene</Text>
        </Pressable>
      </View>
    );
  }

  const fullName = [user?.ad, user?.soyad].filter(Boolean).join(' ').trim();
  const initials = [user?.ad, user?.soyad]
    .map((value) => value?.trim().charAt(0).toUpperCase())
    .filter(Boolean)
    .join('')
    .slice(0, 2) || '?';
  const neighborhoodName = user?.mahalle?.ad?.trim() || null;
  const handleMenuPress = (key: string, title: string) => {
    if (key === 'my-ads') {
      navigation.navigate('MyAds');
      return;
    }

    if (key === 'favorites') {
      navigation.navigate('Favorites');
      return;
    }

    if (key === 'change-password') {
      navigation.navigate('ChangePassword');
      return;
    }

    Alert.alert(title);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerCard}>
        <View style={styles.avatarWrapper}>
          {user?.profile_image ? (
            <Image source={{ uri: user.profile_image }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarFallbackText}>{initials}</Text>
            </View>
          )}
        </View>

        <Text style={styles.fullName}>{fullName || 'İsim bilgisi yok'}</Text>

        {neighborhoodName ? (
          <View style={styles.neighborhoodRow}>
            <Ionicons name="location-outline" size={18} color={APP_COLORS.primary} />
            <Text style={styles.neighborhoodText}>{neighborhoodName}</Text>
          </View>
        ) : null}

        <Pressable style={styles.editButton} onPress={() => navigation.navigate('EditProfile')}>
          <Text style={styles.editButtonText}>Profili Düzenle</Text>
        </Pressable>
      </View>

      <View style={styles.menuCard}>
        {profileMenuItems.map((item, index) => (
          <Pressable
            key={item.key}
            style={[styles.menuRow, index < profileMenuItems.length - 1 && styles.menuRowDivider]}
            onPress={() => handleMenuPress(item.key, item.title)}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconBox, { backgroundColor: item.iconBackgroundColor }]}>
                <Ionicons name={item.icon} size={18} color={item.iconColor} />
              </View>
              <Text style={styles.menuTitle}>{item.title}</Text>
            </View>

            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </Pressable>
        ))}

        {user?.is_admin ? (
          <Pressable
            style={[
              styles.menuRow,
              profileMenuItems.length > 0 && styles.adminMenuRow,
            ]}
            onPress={() => navigation.navigate('AdminPanel')}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconBox, styles.adminIconBox]}>
                <Ionicons name="shield-checkmark-outline" size={18} color="#14532d" />
              </View>
              <Text style={styles.menuTitle}>Admin Paneli</Text>
            </View>

            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </Pressable>
        ) : null}
      </View>

      <Pressable style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Çıkış Yap</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3efe7',
    paddingHorizontal: 20,
    paddingTop: 72,
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#f3efe7',
  },
  stateText: {
    marginTop: 14,
    fontSize: 16,
    color: '#4b5563',
  },
  errorText: {
    marginTop: 12,
    marginBottom: 18,
    fontSize: 16,
    lineHeight: 24,
    color: '#991b1b',
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: APP_COLORS.secondary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  headerCard: {
    alignItems: 'center',
    backgroundColor: '#ffff',
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: '#eadfce',
  },
  avatarWrapper: {
    marginBottom: 18,
  },
  avatarImage: {
    width: 104,
    height: 104,
    borderRadius: 52,
  },
  avatarFallback: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: APP_COLORS.primary,
  },
  avatarFallbackText: {
    color: '#ffffff',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: APP_COLORS.secondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  fullName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 14,
  },
  neighborhoodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 24,
  },
  neighborhoodText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6b7280',
  },
  editButton: {
    minWidth: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: APP_COLORS.secondary,
    opacity: 0.92,
  },
  editButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  menuCard: {
    marginTop: 18,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: '#eadfce',
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 72,
  },
  menuRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1e7d8',
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 14,
    paddingRight: 16,
  },
  menuIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  adminMenuRow: {
    borderTopWidth: 1,
    borderTopColor: '#f1e7d8',
  },
  adminIconBox: {
    backgroundColor: '#dcfce7',
  },
  logoutButton: {
    marginTop: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#1f2937',
  },
  logoutText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
