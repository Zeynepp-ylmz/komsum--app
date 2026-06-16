import { Pressable, StyleSheet, Text, View, ActivityIndicator, ScrollView, Alert, Image } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { AppStackParamList } from '../../navigation/types';
import { AdItem, getAdById, toggleAdFavorite } from '../../api/ads';
import { deleteAdminAd } from '../../api/admin';
import { CurrentUser, getCurrentUser, getFavoriteAds } from '../../api/users';
import { APP_COLORS } from '../../../theme/appColor';

function formatDate(value?: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function AdDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, 'AdDetail'>>();
  const { adId } = route.params;
  const [ad, setAd] = useState<AdItem | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFavoriteLoading, setIsFavoriteLoading] = useState(false);
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadAd = async () => {
      try {
        setIsLoading(true);
        setError('');
        const [data, favoriteAds, user] = await Promise.all([getAdById(adId), getFavoriteAds(), getCurrentUser()]);
        setAd(data);
        setIsFavorite(favoriteAds.some((favoriteAd) => favoriteAd.id === adId));
        setCurrentUser(user);
      } catch (err: any) {
        const message = err?.response?.data?.detail || 'İlan detayı yüklenemedi.';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    loadAd();
  }, [adId]);

  const handleFavoritePress = async () => {
    try {
      setIsFavoriteLoading(true);
      const response = await toggleAdFavorite(adId);
      setIsFavorite(response.durum === 'eklendi');
    } catch (err: any) {
      const message = err?.response?.data?.detail || 'Favori guncellenemedi.';
      Alert.alert('Hata', message);
    } finally {
      setIsFavoriteLoading(false);
    }
  };

  const handleDeleteAd = () => {
    Alert.alert(
      'Ilani Sil',
      'Bu ilani silmek istediginize emin misiniz?',
      [
        {
          text: 'Iptal',
          style: 'cancel',
        },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () => {
            void confirmDeleteAd();
          },
        },
      ],
    );
  };

  const confirmDeleteAd = async () => {
    try {
      setIsDeleteLoading(true);
      await deleteAdminAd(adId);
      navigation.goBack();
    } catch (err: any) {
      const message = err?.response?.data?.detail || 'Ilan silinemedi. Lutfen tekrar deneyin.';
      Alert.alert('Hata', message);
    } finally {
      setIsDeleteLoading(false);
    }
  };

  const ownerName = [ad?.sahibi?.ad, ad?.sahibi?.soyad].filter(Boolean).join(' ').trim();
  const formattedDate = formatDate(ad?.tarih);
  const images = ad?.medyalar?.filter((media) => media.tip === 'image' && media.dosya_yolu) ?? [];
  const isOwnAd = currentUser?.id === ad?.sahibi?.id;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </Pressable>
        <Text style={styles.headerTitle}>İlan Detayı</Text>
        <View style={styles.backButtonPlaceholder} />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={APP_COLORS.secondary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : !ad ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>İlan bulunamadı.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {images.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.galleryContent}
            >
              {images.map((image, index) => (
                <Image
                  key={`${image.dosya_yolu}-${index}`}
                  source={{ uri: image.dosya_yolu }}
                  style={styles.heroImage}
                />
              ))}
            </ScrollView>
          ) : null}

          <View style={styles.card}>

            <Text style={styles.title}>{ad.baslik}</Text>

            {ad.kategori?.ad ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{ad.kategori.ad}</Text>
              </View>
            ) : null}




            {ad.aciklama ? (
              <View style={styles.block}>
                <Text style={styles.blockLabel}>AÇIKLAMA</Text>
                <Text style={styles.blockText}>{ad.aciklama}</Text>
              </View>
            ) : null}

            {ad.sahibi?.mahalle?.ad ? (
              <View style={styles.block}>
                <Text style={styles.blockLabel}>KONUM</Text>
                <Text style={styles.blockText}>
                  {ad.sahibi.mahalle.ad}
                  {ad.sahibi.mahalle.sehir ? ` / ${ad.sahibi.mahalle.sehir}` : ''}
                </Text>
              </View>
            ) : null}

            {formattedDate ? (
              <View style={styles.block}>
                <Text style={styles.blockLabel}>TARİH</Text>
                <Text style={styles.blockText}>{formattedDate}</Text>
              </View>
            ) : null}

            {ownerName ? (
              <View style={styles.block}>
                <Text style={styles.blockLabel}>İLAN SAHİBİ</Text>
                <Text style={styles.blockText}>{ownerName}</Text>
              </View>
            ) : null}

            {ad.etiketler && ad.etiketler.length > 0 ? (
              <View style={styles.block}>
                <Text style={styles.blockLabel}>ETİKETLER</Text>
                <View style={styles.tagsRow}>
                  {ad.etiketler.map((tag) => (
                    <View key={`${tag.id}-${tag.ad}`} style={styles.tag}>
                      <Text style={styles.tagText}>{tag.ad}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {typeof ad.fiyat === 'number' ? (
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.price}>{ad.fiyat === 0 ? 'Ücretsiz' : `${ad.fiyat} TL`}</Text>
              </View>

            ) : null}

          </View>

          {!isOwnAd ? (
            <Pressable
              style={styles.messageButton}
              onPress={() =>
                ad?.sahibi?.id
                  ? navigation.navigate('Chat', {
                    ilanId: ad.id,
                    aliciId: ad.sahibi.id,
                    aliciAdSoyad: [ad.sahibi?.ad, ad.sahibi?.soyad].filter(Boolean).join(' ').trim(),
                    ilanBaslik: ad.baslik,
                  })
                  : undefined
              }
            >
              <Text style={styles.messageButtonText}>Mesaj Gönder</Text>
            </Pressable>
          ) : null}

          <Pressable
            style={[styles.favoriteButton, isFavorite && styles.favoriteButtonActive]}
            onPress={handleFavoritePress}
            disabled={isFavoriteLoading}
          >
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={18}
              color={isFavorite ? '#ffffff' : APP_COLORS.secondary}
            />
            <Text style={[styles.favoriteButtonText, isFavorite && styles.favoriteButtonTextActive]}>
              {isFavoriteLoading
                ? 'Güncelleniyor...'
                : isFavorite
                  ? 'Favorilerden Cıkar'
                  : 'Favorilere Ekle'}
            </Text>
          </Pressable>

          {currentUser?.is_admin ? (
            <Pressable
              style={[styles.adminDeleteButton, isDeleteLoading && styles.adminDeleteButtonDisabled]}
              onPress={handleDeleteAd}
              disabled={isDeleteLoading}
            >
              <Text style={styles.adminDeleteButtonText}>
                {isDeleteLoading ? 'Siliniyor...' : 'İlanı Sil'}
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3efe7',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 58,
    paddingHorizontal: 16,
    paddingBottom: 12,
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
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    padding: 24,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 18,
  },
  heroImage: {
    width: 300,
    height: 240,
    borderRadius: 24,
    backgroundColor: '#e5e7eb',
  },
  galleryContent: {
    gap: 12,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    gap: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#fff3e8',
  },
  badgeText: {
    color: APP_COLORS.secondary,
    fontSize: 12,
    fontWeight: '700',
  },
  price: {
    fontSize: 22,
    fontWeight: '800',
    color: '#c2410c',

  },
  block: {
    gap: 6,
  },
  blockLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: APP_COLORS.secondary,
  },
  blockText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#1f2937',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  messageButton: {
    height: 54,
    borderRadius: 18,
    backgroundColor: APP_COLORS.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  favoriteButton: {
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: APP_COLORS.secondary,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  favoriteButtonActive: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  favoriteButtonText: {
    color: APP_COLORS.secondary,
    fontSize: 16,
    fontWeight: '700',
  },
  favoriteButtonTextActive: {
    color: '#ffffff',
  },
  adminDeleteButton: {
    height: 54,
    borderRadius: 18,
    backgroundColor: '#b91c1c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminDeleteButtonDisabled: {
    opacity: 0.75,
  },
  adminDeleteButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 16,
    textAlign: 'center',
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 16,
    textAlign: 'center',
  },
});
