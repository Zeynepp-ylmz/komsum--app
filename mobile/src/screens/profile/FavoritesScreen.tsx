import { Ionicons } from '@expo/vector-icons';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { APP_COLORS } from '../../../theme/appColor';
import { toggleAdFavorite } from '../../api/ads';
import { getFavoriteAds, CurrentUser, getCurrentUser } from '../../api/users';
import { AdCard } from '../../components/cards/AdCard';
import { AppStackParamList } from '../../navigation/types';
import { AdItem } from '../../api/ads';

export function FavoritesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const isFocused = useIsFocused();
  const [favoriteAds, setFavoriteAds] = useState<AdItem[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadFavorites = async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setErrorMessage(null);
      const [favorites, user] = await Promise.all([getFavoriteAds(), getCurrentUser()]);
      setFavoriteAds(favorites);
      setCurrentUser(user);
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.detail || 'Favoriler yuklenemedi.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleFavoritePress = async (adId: number) => {
    try {
      const response = await toggleAdFavorite(adId);
      setFavoriteAds((currentAds) => {
        if (response.durum === 'cikarildi') {
          return currentAds.filter((ad) => ad.id !== adId);
        }

        return currentAds;
      });
    } catch (error: any) {
      Alert.alert('Hata', error?.response?.data?.detail || 'Favori guncellenemedi.');
    }
  };

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    loadFavorites();
  }, [isFocused]);

  if (isLoading) {
    return (
      <View style={styles.centeredState}>
        <ActivityIndicator size="large" color={APP_COLORS.secondary} />
        <Text style={styles.stateText}>Favoriler yukleniyor...</Text>
      </View>
    );
  }

  if (errorMessage) {
    return (
      <View style={styles.centeredState}>
        <Ionicons name="alert-circle-outline" size={36} color="#b91c1c" />
        <Text style={styles.errorText}>{errorMessage}</Text>
        <Pressable style={styles.retryButton} onPress={() => loadFavorites()}>
          <Text style={styles.retryButtonText}>Tekrar Dene</Text>
        </Pressable>
      </View>
    );
  }

  const favoriteCount = favoriteAds.length;
  const fullName = [currentUser?.ad, currentUser?.soyad].filter(Boolean).join(' ').trim();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#1f2937" />
        </Pressable>

        <View style={styles.headerContent}>
          {
            favoriteCount > 0 ? (
              <Text style={styles.headerSubtitle}>

                Beğendiğin {favoriteCount} ilan
              </Text>
            ) : null
          }

        </View>
      </View>

      <FlatList
        data={favoriteAds}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={favoriteAds.length === 0 ? styles.emptyContainer : styles.listContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadFavorites(true)} />}
        renderItem={({ item }) => (
          <AdCard
            item={item}
            isFavorite
            onPressFavorite={() => handleFavoritePress(item.id)}
            onPressComment={() => navigation.navigate('Comments', { adId: item.id, adTitle: item.baslik })}
            onPressMessage={
              currentUser?.id !== item.sahibi?.id && item.sahibi?.id
                ? () =>
                  navigation.navigate('Chat', {
                    ilanId: item.id,
                    aliciId: item.sahibi!.id,
                    aliciAdSoyad: [item.sahibi?.ad, item.sahibi?.soyad].filter(Boolean).join(' ').trim(),
                    ilanBaslik: item.baslik,
                  })
                : undefined
            }
            onPressDetail={() => navigation.navigate('AdDetail', { adId: item.id })}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrapper}>
              <Ionicons name="heart-outline" size={34} color="white" />
            </View>
            <Text style={styles.emptyTitle}>Henüz favori ilanın yok</Text>
            <Text style={styles.emptyDescription}>
              Beğendiğin ilanları favorilere eklediğinde burada listelenecek.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3efe7',
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 66,
    paddingHorizontal: 20,
    paddingBottom: 18,
    gap: 12,
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
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1f2937',
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 16,
    color: APP_COLORS.primary,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 32,
    gap: 12,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 72,
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 30,
    borderWidth: 1,
    borderColor: '#eadfce',
  },
  emptyIconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: APP_COLORS.primary,
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1f2937',
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
    color: '#6b7280',
  },
});
