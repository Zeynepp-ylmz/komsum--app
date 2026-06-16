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
import { AdItem, toggleAdFavorite } from '../../api/ads';
import { CurrentUser, getCurrentUser, getFavoriteAds, getMyAds } from '../../api/users';
import { AdCard } from '../../components/cards/AdCard';
import { AppStackParamList } from '../../navigation/types';

export function MyAdsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const isFocused = useIsFocused();
  const [ads, setAds] = useState<AdItem[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [favoriteAdIds, setFavoriteAdIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);


  const loadMyAds = async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setErrorMessage(null);
      const [myAds, user, favoriteAds] = await Promise.all([getMyAds(), getCurrentUser(), getFavoriteAds()]);
      setAds(myAds);
      setCurrentUser(user);
      setFavoriteAdIds(favoriteAds.map((ad) => ad.id));
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.detail || 'İlanlar yüklenemedi.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    loadMyAds();
  }, [isFocused]);

  const handleFavoritePress = async (adId: number) => {
    try {
      const response = await toggleAdFavorite(adId);
      setFavoriteAdIds((currentIds) => {
        const nextIds = new Set(currentIds);

        if (response.durum === 'eklendi') {
          nextIds.add(adId);
        } else {
          nextIds.delete(adId);
        }

        return Array.from(nextIds);
      });
    } catch (error: any) {
      const message = error?.response?.data?.detail || 'Favori güncellenemedi.';
      Alert.alert('Hata', message);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centeredState}>
        <ActivityIndicator size="large" color={APP_COLORS.secondary} />
        <Text style={styles.stateText}>İlanların yükleniyor...</Text>
      </View>
    );
  }

  if (errorMessage) {
    return (
      <View style={styles.centeredState}>
        <Ionicons name="alert-circle-outline" size={36} color="#b91c1c" />
        <Text style={styles.errorText}>{errorMessage}</Text>
        <Pressable style={styles.retryButton} onPress={() => loadMyAds()}>
          <Text style={styles.retryButtonText}>Tekrar Dene</Text>
        </Pressable>
      </View>
    );
  }

  const adCount = ads.length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#1f2937" />
        </Pressable>

        <View style={styles.headerContent}>

          {adCount > 0 ? (
            <Text style={styles.headerSubtitle}>İlanladığın {adCount} ilan</Text>
          ) : null}
        </View>
      </View>

      <FlatList
        data={ads}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={ads.length === 0 ? styles.emptyContainer : styles.listContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadMyAds(true)} />}
        renderItem={({ item }) => (
          <AdCard
            item={item}
            isFavorite={favoriteAdIds.includes(item.id)}
            onPressFavorite={() => handleFavoritePress(item.id)}
            onPressComment={() => navigation.navigate('Comments', { adId: item.id, adTitle: item.baslik })}
            onPressEdit={() => navigation.navigate('IlanOlustur', { mode: 'edit', ad: item })}
            onPressDetail={() => navigation.navigate('AdDetail', { adId: item.id })}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrapper}>
              <Ionicons name="pricetags-outline" size={34} color="#ffffff" />
            </View>
            <Text style={styles.emptyTitle}>Henüz ilan oluşturmadın</Text>
            <Text style={styles.emptyDescription}>
              Oluşturduğun ilanlar burada listelenecek.
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
