import { Ionicons } from '@expo/vector-icons';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CommentItem, getComments } from '../../api/comments';
import { getAds, AdItem, CategoryItem, getCategories, toggleAdFavorite } from '../../api/ads';
import { AdCard } from '../../components/cards/AdCard';
import { CurrentUser, getCurrentUser, getFavoriteAds, getMyAds } from '../../api/users';
import { APP_COLORS } from '../../../theme/appColor';
import { AppStackParamList } from '../../navigation/types';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getSeenCommentNotificationIds, setSeenCommentNotificationIds } from '../../services/commentNotificationStorage';
import { messageSocket } from '../../services/messageSocket';


type CommentNotificationItem = {
  adId: number;
  adTitle: string;
  comment: CommentItem;
};

const HOME_RECENT_ADS_DAYS = 7;

function isAdWithinLastDays(ad: AdItem, days: number) {
  const adTimestamp = new Date(ad.tarih).getTime();
  if (Number.isNaN(adTimestamp)) {
    return false;
  }

  const thresholdTimestamp = Date.now() - days * 24 * 60 * 60 * 1000;
  return adTimestamp >= thresholdTimestamp;
}

export function HomeScreen() {

  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const isFocused = useIsFocused();
  const [ads, setAds] = useState<AdItem[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [favoriteAdIds, setFavoriteAdIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCategoryLoading, setIsCategoryLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [commentNotifications, setCommentNotifications] = useState<CommentNotificationItem[]>([]);
  const [unreadCommentCount, setUnreadCommentCount] = useState(0);
  const [isNotificationDropdownOpen, setIsNotificationDropdownOpen] = useState(false);

  const buildCommentNotifications = async (userId: number) => {
    const myAds = await getMyAds();
    const commentsPerAd = await Promise.all(
      myAds.map(async (ad) => ({
        ad,
        comments: await getComments(ad.id),
      })),
    );

    const notifications = commentsPerAd
      .flatMap(({ ad, comments }) =>
        comments
          .filter((comment) => comment.yazan_kullanici_id !== userId)
          .map((comment) => ({
            adId: ad.id,
            adTitle: ad.baslik,
            comment,
          })),
      )
      .sort((left, right) => new Date(right.comment.tarih).getTime() - new Date(left.comment.tarih).getTime());

    const seenIds = await getSeenCommentNotificationIds(userId);
    setCommentNotifications(notifications);
    setUnreadCommentCount(notifications.filter((item) => !seenIds.includes(item.comment.id)).length);
  };

  const loadAds = async (refresh = false, rawSearchText?: string, rawCategoryId?: number | null) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
      } else if (isLoading) {
        setIsLoading(true);
      } else {
        setIsCategoryLoading(true);
      }

      const normalizedSearch = (rawSearchText ?? searchText).trim();
      const activeCategoryId = rawCategoryId ?? selectedCategoryId;
      const adsPromise = normalizedSearch
        ? Promise.all([
          getAds({
            q: normalizedSearch,
            ...(activeCategoryId ? { kategori_id: activeCategoryId } : {}),
          }),
          getAds({
            etiket_arama: normalizedSearch,
            ...(activeCategoryId ? { kategori_id: activeCategoryId } : {}),
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
        : getAds(activeCategoryId ? { kategori_id: activeCategoryId } : undefined);

      const [adsData, userData, categoryData, favoriteAdsData] = await Promise.all([
        adsPromise,
        getCurrentUser(),
        getCategories(),
        getFavoriteAds(),
      ]);
      setAds(adsData.filter((ad) => isAdWithinLastDays(ad, HOME_RECENT_ADS_DAYS)));
      setCurrentUser(userData);
      setCategories(categoryData.filter((category) => category.ad.trim().toLowerCase() !== 'tümü' && category.ad.trim().toLowerCase() !== 'tumu'));
      setFavoriteAdIds(favoriteAdsData.map((ad) => ad.id));
      await buildCommentNotifications(userData.id);
    } catch (error: any) {
      const message = error?.response?.data?.detail || 'İlanlar yüklenemedi.';
      Alert.alert('Hata', message);
    } finally {
      setIsLoading(false);
      setIsCategoryLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    const timeoutId = setTimeout(() => {
      loadAds(false, searchText, selectedCategoryId);
    }, 350);

    return () => clearTimeout(timeoutId);
  }, [searchText, selectedCategoryId, isFocused]);

  useEffect(() => {
    if (!isFocused || !currentUser?.id) {
      return;
    }

    const unsubscribe = messageSocket.subscribe((event) => {
      if (event.type !== 'notification:new' || event.kind !== 'comment') {
        return;
      }

      void buildCommentNotifications(currentUser.id);
    });

    return unsubscribe;
  }, [currentUser?.id, isFocused]);

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

  const handleNotificationPress = async () => {
    const nextIsOpen = !isNotificationDropdownOpen;
    setIsNotificationDropdownOpen(nextIsOpen);

    if (!nextIsOpen || !currentUser) {
      return;
    }

    const seenIds = commentNotifications.map((item) => item.comment.id);
    await setSeenCommentNotificationIds(currentUser.id, seenIds);
    setUnreadCommentCount(0);
  };

  const handleNotificationItemPress = (item: CommentNotificationItem) => {
    setIsNotificationDropdownOpen(false);
    navigation.navigate('Comments', { adId: item.adId, adTitle: item.adTitle });
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const userInitial = currentUser?.ad?.trim().charAt(0).toUpperCase() || '?';
  const neighborhoodName = currentUser?.mahalle?.ad || '-';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTextBlock}>
          <Text style={styles.brandTitle}>KOMŞUM</Text>
          <View style={styles.greetingRow}>
            <Text style={styles.greeting}>Merhaba, {currentUser?.ad || ''}</Text>
            <Text style={styles.waveIcon}>👋</Text>
          </View>
          <View style={styles.neighborhoodRow}>
            <Ionicons name="location-outline" size={16} color={APP_COLORS.primary} />
            <Text style={styles.neighborhood}>{neighborhoodName}</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <Pressable style={styles.iconButton} onPress={handleNotificationPress}>
            <Ionicons name="notifications-outline" size={26} color="#1f2937" />
            {unreadCommentCount > 0 ? (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {unreadCommentCount > 99 ? '99+' : unreadCommentCount}
                </Text>
              </View>
            ) : null}
          </Pressable>

          <View style={styles.avatar}>
            {currentUser?.profile_image ? (
              <Image source={{ uri: currentUser.profile_image }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarPlaceholder}>{userInitial}</Text>
            )}
          </View>
        </View>
      </View>

      {isNotificationDropdownOpen ? (
        <>
          <Pressable style={styles.dropdownBackdrop} onPress={() => setIsNotificationDropdownOpen(false)} />
          <View style={styles.notificationDropdown}>
            <Text style={styles.notificationDropdownTitle}>İlanlarına gelen yorumlar</Text>
            <ScrollView
              style={styles.notificationDropdownScroll}
              contentContainerStyle={styles.notificationDropdownContent}
              nestedScrollEnabled
            >
              {commentNotifications.length === 0 ? (
                <Text style={styles.notificationEmptyText}>Henüz yorum bildirimi yok.</Text>
              ) : (
                commentNotifications.map((item) => {
                  const commenterName = [item.comment.yazan_ad, item.comment.yazan_soyad].filter(Boolean).join(' ').trim();
                  return (
                    <Pressable
                      key={`${item.adId}-${item.comment.id}`}
                      style={styles.notificationItem}
                      onPress={() => handleNotificationItemPress(item)}
                    >
                      <Text style={styles.notificationItemTitle} numberOfLines={1}>
                        {item.adTitle}
                      </Text>
                      <Text style={styles.notificationItemSubtitle} numberOfLines={1}>
                        {commenterName || 'Bir kullanıcı'}: {item.comment.icerik}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </View>
        </>
      ) : null}

      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color="#6b7280" />
        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Başlık, acıklama veya etiket ara..."
          placeholderTextColor="#9ca3af"
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>
      <View style={styles.categoryScroll}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScrollContent}

        >
          <Pressable
            style={[styles.categoryChip, selectedCategoryId === null && styles.categoryChipActive]}
            onPress={() => setSelectedCategoryId(null)}
          >
            <Text style={[styles.categoryChipText, selectedCategoryId === null && styles.categoryChipTextActive]}>Tümü</Text>
          </Pressable>



          {categories.map((category) => {
            const isSelected = selectedCategoryId === category.id;
            return (
              <Pressable
                key={category.id}
                style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
                onPress={() => setSelectedCategoryId(category.id)}
              >
                <Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextActive]}>{category.ad}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.title}>Mahallendeki İlanlar</Text>
        <Pressable onPress={() => navigation.navigate('AllAds')}>
          <Text style={styles.showAllText}>Tümünü Göster</Text>
        </Pressable>
      </View>


      {isCategoryLoading ? (
        <View style={styles.inlineLoader}>
          <ActivityIndicator size="small" color={APP_COLORS.secondary} />
        </View>
      ) : null}


      <FlatList
        data={ads}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={ads.length === 0 ? styles.emptyContainer : styles.listContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadAds(true)} />}
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
        ListEmptyComponent={<Text style={styles.emptyText}>Henüz ilgili ilandan yok.</Text>}
      />

      <Pressable
        style={styles.fab}
        onPress={() => navigation.navigate('IlanOlustur')}
      >
        <Ionicons name="add" size={30} color="#ffffff" />
      </Pressable>

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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 14,
  },
  headerTextBlock: {
    flex: 1,
    paddingRight: 16,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: APP_COLORS.secondary,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1f2937',
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  waveIcon: {
    fontSize: 18,
  },
  neighborhoodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  neighborhood: {
    fontSize: 15,
    color: '#6b7280',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
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
  categoryScroll: {
    marginBottom: 16
  },
  categoryScrollContent: {
    paddingHorizontal: 16,
    gap: 5,
  },
  categoryChip: {
    paddingHorizontal: 20,
    height: 50,
    paddingVertical: 13,
    borderRadius: 100,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  categoryChipActive: {
    backgroundColor: APP_COLORS.secondary,
    borderColor: APP_COLORS.secondary,
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  categoryChipTextActive: {
    color: '#ffffff',
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626',
  },
  notificationBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  dropdownBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 8,
  },
  notificationDropdown: {
    position: 'absolute',
    top: 96,
    right: 80,
    width: 290,
    maxHeight: 280,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 14,
    shadowColor: '#111827',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 8,
    zIndex: 15,
  },
  notificationDropdownTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: APP_COLORS.primary,
    marginBottom: 10,
  },
  notificationDropdownScroll: {
    maxHeight: 220,
  },
  notificationDropdownContent: {
    gap: 8,
  },
  notificationItem: {
    borderRadius: 20,
    paddingBottom: 12,
    borderWidth: 1,
    borderColor: APP_COLORS.primary,
    gap: 4,
    justifyContent: 'center',
    paddingLeft: 10,
    paddingTop: 6
  },
  notificationItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1f2937',
  },
  notificationItemSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  notificationEmptyText: {
    fontSize: 14,
    color: '#6b7280',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d97706',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
  },
  showAllText: {
    fontSize: 14,
    fontWeight: '700',
    color: APP_COLORS.secondary,
    textDecorationLine: 'underline'
  },
  inlineLoader: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
  },
  listContent: {
    padding: 16,
    paddingBottom: 140,
    gap: 12,
  },
  emptyContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    paddingBottom: 140,
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 16,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: APP_COLORS.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
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
