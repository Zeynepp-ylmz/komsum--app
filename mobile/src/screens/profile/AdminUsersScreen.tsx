import { useIsFocused } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { APP_COLORS } from '../../../theme/appColor';
import { getAdminUsers, AdminUser } from '../../api/admin';
import { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'AdminUsers'>;

export function AdminUsersScreen({ navigation, route }: Props) {
  const { cityName, districtName, neighborhoodName, neighborhoodId } = route.params;
  const isFocused = useIsFocused();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [searchText, setSearchText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadUsers = async (refresh = false, rawSearchText?: string) => {
    try {
      setErrorMessage('');

      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const data = await getAdminUsers({
        mahalleId: neighborhoodId,
        q: rawSearchText ?? searchText,
      });
      setUsers(data);
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.detail || 'Kullanıcılar yüklenemedi.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    const timeoutId = setTimeout(() => {
      void loadUsers(false, searchText);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchText, neighborhoodId, isFocused]);

  const renderUserCard = ({ item }: { item: AdminUser }) => {
    const fullName = [item.ad, item.soyad].filter(Boolean).join(' ').trim();
    const initials = [item.ad, item.soyad]
      .map((value) => value?.trim().charAt(0).toUpperCase())
      .filter(Boolean)
      .join('')
      .slice(0, 2) || '?';

    return (
      <Pressable
        style={styles.userCard}
        onPress={() =>
          navigation.navigate('AdminUserDetail', {
            user: item,
            cityName,
            districtName,
            neighborhoodName,
          })}
      >
        {item.profil_resmi ? (
          <Image source={{ uri: item.profil_resmi }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarFallbackText}>{initials}</Text>
          </View>
        )}

        <View style={styles.userInfo}>
          <Text style={styles.userName}>{fullName || 'İsim bilgisi yok'}</Text>
          <Text style={styles.userEmail}>{item.eposta}</Text>
          <Text style={styles.userRole}>{item.is_admin ? 'Rol: Admin' : 'Rol: Kullanıcı'}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={users}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderUserCard}
        contentContainerStyle={users.length === 0 ? styles.emptyContainer : styles.listContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void loadUsers(true)} />}
        ListHeaderComponent={(
          <View style={styles.headerContent}>
            <View style={styles.topBar}>
              <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
                <Ionicons name="chevron-back" size={22} color="#1f2937" />
              </Pressable>

              <View style={styles.backButtonPlaceholder} />
            </View>



            <View style={styles.searchContainer}>
              <Ionicons name="search-outline" size={20} color="#6b7280" />
              <TextInput
                value={searchText}
                onChangeText={setSearchText}
                placeholder="Ad, soyad veya e-posta ara..."
                placeholderTextColor="#9ca3af"
                style={styles.searchInput}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
            </View>

            {isLoading ? (
              <View style={styles.loaderBox}>
                <ActivityIndicator size="large" color={APP_COLORS.secondary} />
                <Text style={styles.stateText}>Kullanıcılar yükleniyor...</Text>
              </View>
            ) : null}

            {!!errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
                <Pressable style={styles.retryButton} onPress={() => void loadUsers(false)}>
                  <Text style={styles.retryButtonText}>Tekrar Dene</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        )}
        ListEmptyComponent={
          !isLoading && !errorMessage ? (
            <Text style={styles.emptyText}>Bu bölgede eşleşen kullanıcı bulunamadı.</Text>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3efe7',
  },
  headerContent: {
    paddingTop: 24,
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 14,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  backButtonPlaceholder: {
    width: 40,
    height: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1f2937',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },
  loaderBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
  },
  stateText: {
    marginTop: 12,
    fontSize: 15,
    color: '#4b5563',
  },
  errorBox: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    gap: 10,
  },
  errorText: {
    color: '#be123c',
    fontSize: 14,
    lineHeight: 20,
  },
  retryButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: APP_COLORS.secondary,
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
    gap: 12,
  },
  emptyContainer: {
    flexGrow: 1,
    paddingBottom: 120,
  },
  emptyText: {
    paddingTop: 32,
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 16,
    paddingHorizontal: 24,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#ffffff',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#eadfce',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  avatarImage: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },
  avatarFallback: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: APP_COLORS.primary,
  },
  avatarFallbackText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  userInfo: {
    flex: 1,
    gap: 4,
  },
  userName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1f2937',
  },
  userEmail: {
    fontSize: 14,
    color: '#4b5563',
  },
  userRole: {
    fontSize: 13,
    fontWeight: '700',
    color: APP_COLORS.secondary,
  },
});
