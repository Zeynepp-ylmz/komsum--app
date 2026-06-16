import { useIsFocused } from '@react-navigation/native';
import { Alert, ActivityIndicator, FlatList } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { APP_COLORS } from '../../../theme/appColor';
import { AdCard } from '../../components/cards/AdCard';
import { AdItem, getAds } from '../../api/ads';
import { deleteAdminUser } from '../../api/admin';
import { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'AdminUserDetail'>;

export function AdminUserDetailScreen({ navigation, route }: Props) {
  const { user, cityName, districtName, neighborhoodName } = route.params;
  const isFocused = useIsFocused();
  const [isDeleting, setIsDeleting] = useState(false);
  const [userAds, setUserAds] = useState<AdItem[]>([]);
  const [isLoadingAds, setIsLoadingAds] = useState(true);
  const [adsError, setAdsError] = useState('');
  const fullName = [user.ad, user.soyad].filter(Boolean).join(' ').trim();
  const initials = [user.ad, user.soyad]
    .map((value) => value?.trim().charAt(0).toUpperCase())
    .filter(Boolean)
    .join('')
    .slice(0, 2) || '?';

  const resolvedCityName = cityName || user.mahalle?.sehir || '-';
  const resolvedDistrictName = districtName || '-';
  const resolvedNeighborhoodName = neighborhoodName || user.mahalle?.ad || '-';

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    const loadUserAds = async () => {
      try {
        setIsLoadingAds(true);
        setAdsError('');
        const ads = await getAds();
        setUserAds(ads.filter((item) => item.sahibi?.id === user.id));
      } catch (error: any) {
        setAdsError(error?.response?.data?.detail || 'Kullanıcının ilanları yüklenemedi.');
      } finally {
        setIsLoadingAds(false);
      }
    };

    void loadUserAds();
  }, [isFocused, user.id]);

  const handleDeleteUser = () => {
    Alert.alert(
      'Kullaniciyi Sil',
      `${fullName || 'Bu kullanıcıyı'} silmek istediginize emin misiniz?`,
      [
        {
          text: 'İptal',
          style: 'cancel',
        },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () => {
            void confirmDeleteUser();
          },
        },
      ],
    );
  };

  const confirmDeleteUser = async () => {
    try {
      setIsDeleting(true);
      await deleteAdminUser(user.id);
      navigation.goBack();
    } catch (error: any) {
      const message =
        error?.response?.data?.detail ||
        'Kullanıcı silinirken bir hata oluştu. Lütfen tekrar deneyin.';
      Alert.alert('Hata', message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={userAds}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={userAds.length === 0 ? styles.emptyContainer : styles.listContent}
        ListHeaderComponent={(
          <View style={styles.content}>
            <View style={styles.topBar}>
              <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
                <Ionicons name="chevron-back" size={22} color="#1f2937" />
              </Pressable>
              <Text style={styles.title}>Kullanıcı Detayı</Text>
              <View style={styles.backButtonPlaceholder} />
            </View>

            <View style={styles.profileCard}>
              {user.profil_resmi ? (
                <Image source={{ uri: user.profil_resmi }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarFallbackText}>{initials}</Text>
                </View>
              )}

              <Text style={styles.fullName}>{fullName || 'İsim bilgisi yok'}</Text>
            </View>

            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Ad Soyad</Text>
                <Text style={styles.infoValue}>{fullName || '-'}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>E-posta</Text>
                <Text style={styles.infoValue}>{user.eposta || '-'}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Rol</Text>
                <Text style={styles.infoValue}>{user.is_admin ? 'Admin' : 'Kullanıcı'}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Bölge</Text>
                <Text style={styles.infoValue}>
                  {resolvedCityName} / {resolvedDistrictName} / {resolvedNeighborhoodName}
                </Text>
              </View>
            </View>

            <Pressable
              style={[styles.deleteButton, isDeleting && styles.deleteButtonDisabled]}
              onPress={handleDeleteUser}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.deleteButtonText}>Kullanıcıyı Sil</Text>
              )}
            </Pressable>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Kullanıcının İlanları</Text>
            </View>

            {isLoadingAds ? (
              <View style={styles.stateBox}>
                <ActivityIndicator size="large" color={APP_COLORS.secondary} />
                <Text style={styles.stateText}>İlanlar yükleniyor...</Text>
              </View>
            ) : null}

            {!!adsError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{adsError}</Text>
              </View>
            ) : null}
          </View>
        )}
        renderItem={({ item }) => (
          <AdCard
            item={item}
            onPressDetail={() => navigation.navigate('AdDetail', { adId: item.id })}
          />
        )}
        ListEmptyComponent={
          !isLoadingAds && !adsError ? (
            <Text style={styles.emptyText}>Bu kullanıcıya ait ilan bulunamadı.</Text>
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
  content: {
    paddingTop: 24,
    paddingHorizontal: 16,
    gap: 16,
    paddingBottom: 16,
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
  profileCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: '#eadfce',
  },
  avatarImage: {
    width: 92,
    height: 92,
    borderRadius: 46,
    marginBottom: 14,
  },
  avatarFallback: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: APP_COLORS.primary,
    marginBottom: 14,
  },
  avatarFallbackText: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
  },
  fullName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1f2937',
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#eadfce',
    gap: 14,
  },
  infoRow: {
    gap: 6,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: APP_COLORS.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 16,
    lineHeight: 24,
    color: '#1f2937',
    fontWeight: '600',
  },
  sectionHeader: {
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1f2937',
  },
  deleteButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#b91c1c',
  },
  deleteButtonDisabled: {
    opacity: 0.75,
  },
  deleteButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  stateBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
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
  },
  errorText: {
    color: '#be123c',
    fontSize: 14,
    lineHeight: 20,
  },
  listContent: {
    paddingBottom: 120,
    paddingHorizontal: 16,
    gap: 12,
  },
  emptyContainer: {
    flexGrow: 1,
    paddingBottom: 120,
  },
  emptyText: {
    paddingTop: 16,
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 16,
    paddingHorizontal: 24,
  },
});
