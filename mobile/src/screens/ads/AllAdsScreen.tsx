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
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { APP_COLORS } from '../../../theme/appColor';
import { AdCard } from '../../components/cards/AdCard';
import { AppStackParamList } from '../../navigation/types';
import { AdItem, CategoryItem, getAds, getCategories, GetAdsParams, toggleAdFavorite } from '../../api/ads';
import { CurrentUser, getCurrentUser, getFavoriteAds } from '../../api/users';

const DAY_FILTER_OPTIONS = [
  { label: 'Tümü', value: null },
  { label: '1 Gün', value: 1 },
  { label: '3 Gün', value: 3 },
  { label: '7 Gün', value: 7 },
  { label: '30 Gün', value: 30 },
] as const;

export function AllAdsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const isFocused = useIsFocused();
  const [ads, setAds] = useState<AdItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [favoriteAdIds, setFavoriteAdIds] = useState<number[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [selectedDayCount, setSelectedDayCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFilterLoading, setIsFilterLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadAds = async (refresh = false) => {
    try {
      setErrorMessage('');

      if (refresh) {
        setIsRefreshing(true);
      } else if (isLoading) {
        setIsLoading(true);
      } else {
        setIsFilterLoading(true);
      }

      const normalizedSearch = searchText.trim();
      const parsedMinPrice = minPrice.trim() ? Number(minPrice) : undefined;
      const parsedMaxPrice = maxPrice.trim() ? Number(maxPrice) : undefined;
      const baseParams: GetAdsParams = {
        ...(selectedCategoryId ? { kategori_id: selectedCategoryId } : {}),
        ...(typeof parsedMinPrice === 'number' && !Number.isNaN(parsedMinPrice) ? { min_fiyat: parsedMinPrice } : {}),
        ...(typeof parsedMaxPrice === 'number' && !Number.isNaN(parsedMaxPrice) ? { max_fiyat: parsedMaxPrice } : {}),
        ...(selectedDayCount ? { son_kac_gun: selectedDayCount } : {}),
      };

      const adsPromise = normalizedSearch
        ? Promise.all([
          getAds({
            ...baseParams,
            q: normalizedSearch,
          }),
          getAds({
            ...baseParams,
            etiket_arama: normalizedSearch,
          }),
        ]).then(([queryResults, tagResults]) => {
          const mergedAds = [...queryResults];
          const seenIds = new Set(queryResults.map((ad) => ad.id));

          for (const ad of tagResults) {
            if (!seenIds.has(ad.id)) {
              mergedAds.push(ad);
              seenIds.add(ad.id);
            }
          }

          return mergedAds;
        })
        : getAds(baseParams);

      const [adsData, categoryData, favoriteAdsData, userData] = await Promise.all([
        adsPromise,
        getCategories(),
        getFavoriteAds(),
        getCurrentUser(),
      ]);

      setAds(adsData);
      setCategories(
        categoryData.filter((category) => category.ad.trim().toLowerCase() !== 'tümü' && category.ad.trim().toLowerCase() !== 'tumu'),
      );
      setFavoriteAdIds(favoriteAdsData.map((ad) => ad.id));
      setCurrentUser(userData);
    } catch (error: any) {
      const message = error?.response?.data?.detail || 'İlanlar yüklenemedi.';
      setErrorMessage(message);

      if (!refresh && !isLoading) {
        Alert.alert('Hata', message);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setIsFilterLoading(false);
    }
  };

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    const timeoutId = setTimeout(() => {
      loadAds(false);
    }, 350);

    return () => clearTimeout(timeoutId);
  }, [searchText, selectedCategoryId, minPrice, maxPrice, selectedDayCount, isFocused]);

  const handleFavoritePress = async (adId: number) => {
    try {
      const response = await toggleAdFavorite(adId);
      setFavoriteAdIds((currentIds) => {
        const currentSet = new Set(currentIds);

        if (response.durum === 'eklendi') {
          currentSet.add(adId);
        } else {
          currentSet.delete(adId);
        }

        return Array.from(currentSet);
      });
    } catch (error: any) {
      const message = error?.response?.data?.detail || 'Favori güncellenemedi.';
      Alert.alert('Hata', message);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={APP_COLORS.secondary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={ads}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={ads.length === 0 ? styles.emptyContainer : styles.listContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadAds(true)} />}
        ListHeaderComponent={(
          <View style={styles.headerContent}>
            <View style={styles.topBar}>
              <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
                <Ionicons name="chevron-back" size={22} color="#1f2937" />
              </Pressable>
              <Text style={styles.title}>Tüm İlanlar</Text>
              <View style={styles.backButtonPlaceholder} />
            </View>

            <View style={styles.searchContainer}>
              <Ionicons name="search-outline" size={20} color="#6b7280" />
              <TextInput
                value={searchText}
                onChangeText={setSearchText}
                placeholder="Başlık, açıklama veya etiket ara..."
                placeholderTextColor="#9ca3af"
                style={styles.searchInput}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
            </View>

            <Text style={styles.filterTitle}>Kategori</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipScrollContent}
              style={styles.chipScroll}
            >
              <Pressable
                style={[styles.chip, selectedCategoryId === null && styles.chipActive]}
                onPress={() => setSelectedCategoryId(null)}
              >
                <Text style={[styles.chipText, selectedCategoryId === null && styles.chipTextActive]}>Tümü</Text>
              </Pressable>

              {categories.map((category) => {
                const isSelected = selectedCategoryId === category.id;
                return (
                  <Pressable
                    key={category.id}
                    style={[styles.chip, isSelected && styles.chipActive]}
                    onPress={() => setSelectedCategoryId(category.id)}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>{category.ad}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.priceRow}>
              <View style={styles.priceField}>
                <Text style={styles.inputLabel}>Min Fiyat</Text>
                <TextInput
                  value={minPrice}
                  onChangeText={setMinPrice}
                  placeholder="0"
                  placeholderTextColor="#9ca3af"
                  style={styles.textInput}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.priceField}>
                <Text style={styles.inputLabel}>Max Fiyat</Text>
                <TextInput
                  value={maxPrice}
                  onChangeText={setMaxPrice}
                  placeholder="5000"
                  placeholderTextColor="#9ca3af"
                  style={styles.textInput}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <Text style={styles.filterTitle}>Son Kaç Gün</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipScrollContent}
              style={styles.dayChipScroll}
            >
              {DAY_FILTER_OPTIONS.map((option) => {
                const isSelected = selectedDayCount === option.value;
                return (
                  <Pressable
                    key={option.label}
                    style={[styles.chip, isSelected && styles.chipActive]}
                    onPress={() => setSelectedDayCount(option.value)}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {isFilterLoading ? (
              <View style={styles.inlineLoader}>
                <ActivityIndicator size="small" color={APP_COLORS.secondary} />
              </View>
            ) : null}

            {errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
                <Pressable style={styles.retryButton} onPress={() => loadAds(false)}>
                  <Text style={styles.retryButtonText}>Tekrar Dene</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        )}
        renderItem={({ item }) => (
          <AdCard
            item={item}
            isFavorite={favoriteAdIds.includes(item.id)}
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
        ListEmptyComponent={<Text style={styles.emptyText}>Sonuç bulunamadı.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3efe7',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3efe7',
  },
  headerContent: {
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
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
    marginBottom: 14,
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
  filterTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 10,
  },
  chipScroll: {
    marginBottom: 14,
  },
  dayChipScroll: {
    marginBottom: 10,
  },
  chipScrollContent: {
    gap: 8,
    paddingRight: 16,
  },
  chip: {
    paddingHorizontal: 18,
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  chipActive: {
    backgroundColor: APP_COLORS.secondary,
    borderColor: APP_COLORS.secondary,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  chipTextActive: {
    color: '#ffffff',
  },
  priceRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  priceField: {
    flex: 1,
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  textInput: {
    height: 46,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    color: '#111827',
    fontSize: 15,
  },
  inlineLoader: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  errorBox: {
    marginTop: 8,
    marginBottom: 8,
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
    paddingBottom: 120,
    paddingHorizontal: 16,
    gap: 12,
  },
  emptyContainer: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  emptyText: {
    paddingTop: 40,
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 16,
  },
});
