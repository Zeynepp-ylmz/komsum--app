import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { APP_COLORS } from '../../../theme/appColor';
import { AdminStats, getAdminStats } from '../../api/admin';
import { CityItem, DistrictItem, getCities, getDistricts, getNeighborhoods, NeighborhoodItem } from '../../api/locations';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../../navigation/types';

type PickerType = 'city' | 'district' | 'neighborhood' | null;

type SelectedRegion = {
  city: CityItem;
  district: DistrictItem;
  neighborhood: NeighborhoodItem;
};

export function AdminPanelScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [cities, setCities] = useState<CityItem[]>([]);
  const [districts, setDistricts] = useState<DistrictItem[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodItem[]>([]);
  const [selectedCity, setSelectedCity] = useState<CityItem | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictItem | null>(null);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<NeighborhoodItem | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<SelectedRegion | null>(null);
  const [pickerType, setPickerType] = useState<PickerType>(null);
  const [isFilterVisible, setIsFilterVisible] = useState(true);
  const [isLoadingCities, setIsLoadingCities] = useState(true);
  const [isLoadingDistricts, setIsLoadingDistricts] = useState(false);
  const [isLoadingNeighborhoods, setIsLoadingNeighborhoods] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  useEffect(() => {
    const loadCities = async () => {
      try {
        setIsLoadingCities(true);
        const data = await getCities();
        setCities(data);
      } catch {
        Alert.alert('Hata', 'Şehirler yÜklenemedi.');
      } finally {
        setIsLoadingCities(false);
      }
    };

    void loadCities();
  }, []);

  const handleSelectCity = async (city: CityItem) => {
    setSelectedCity(city);
    setSelectedDistrict(null);
    setSelectedNeighborhood(null);
    setDistricts([]);
    setNeighborhoods([]);
    setPickerType(null);

    try {
      setIsLoadingDistricts(true);
      const data = await getDistricts(city.id);
      setDistricts(data);
    } catch {
      Alert.alert('Hata', 'İlçeler yüklenemedi.');
    } finally {
      setIsLoadingDistricts(false);
    }
  };

  const handleSelectDistrict = async (district: DistrictItem) => {
    setSelectedDistrict(district);
    setSelectedNeighborhood(null);
    setNeighborhoods([]);
    setPickerType(null);

    try {
      setIsLoadingNeighborhoods(true);
      const data = await getNeighborhoods(district.id);
      setNeighborhoods(data);
    } catch {
      Alert.alert('Hata', 'Mahalleler yüklenemedi.');
    } finally {
      setIsLoadingNeighborhoods(false);
    }
  };

  const handleSelectNeighborhood = (neighborhood: NeighborhoodItem) => {
    setSelectedNeighborhood(neighborhood);
    setPickerType(null);
  };

  const handleApplyFilter = async () => {
    if (!selectedCity || !selectedDistrict || !selectedNeighborhood) {
      Alert.alert('Eksik Seçim', 'Şehir, ilce ve mahalle seçimi yapın.');
      return;
    }

    setSelectedRegion({
      city: selectedCity,
      district: selectedDistrict,
      neighborhood: selectedNeighborhood,
    });
    setIsFilterVisible(false);

    try {
      setIsLoadingStats(true);
      setStatsError(null);
      const data = await getAdminStats(selectedNeighborhood.id);
      setStats(data);
    } catch (error: any) {
      setStats(null);
      setStatsError(error?.response?.data?.detail || 'Admin istatistikleri yüklenemedi.');
    } finally {
      setIsLoadingStats(false);
    }
  };

  const handleResetRegionSelection = () => {
    setSelectedCity(null);
    setSelectedDistrict(null);
    setSelectedNeighborhood(null);
    setSelectedRegion(null);
    setDistricts([]);
    setNeighborhoods([]);
    setStats(null);
    setStatsError(null);
    setIsLoadingStats(false);
    setPickerType(null);
    setIsFilterVisible(true);
  };

  const pickerItems = pickerType === 'city'
    ? cities
    : pickerType === 'district'
      ? districts
      : neighborhoods;

  const pickerTitle = pickerType === 'city'
    ? 'Sehir Sec'
    : pickerType === 'district'
      ? 'Ilce Sec'
      : 'Mahalle Sec';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={{ flexDirection: 'row', paddingBottom: 10 }}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color="#1f2937" />
          </Pressable>
          {
            isFilterVisible ? (

              <Text style={styles.title}>Admin Paneli</Text>
            ) : null
          }

        </View>

        {selectedRegion ? (
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Ionicons name="location-outline" size={16} color={APP_COLORS.primary} />
              <Text style={styles.regionText}>
                {selectedRegion.city.ad} / {selectedRegion.district.ad} / {selectedRegion.neighborhood.ad}
              </Text>
            </View>


          </View>
        ) : null}

        {isFilterVisible ? (
          <View style={styles.filterCard}>
            <Text style={styles.sectionLabel}>Bölge Filtresi</Text>

            <Pressable
              style={[styles.selectInput, isLoadingCities && styles.selectInputDisabled]}
              onPress={() => !isLoadingCities && setPickerType('city')}
              disabled={isLoadingCities}
            >
              <Text style={selectedCity ? styles.selectValue : styles.selectPlaceholder}>
                {selectedCity?.ad || (isLoadingCities ? 'Şehirler yükleniyor...' : 'Şehir seçin')}
              </Text>
              {isLoadingCities ? <ActivityIndicator size="small" color={APP_COLORS.secondary} /> : <Ionicons name="chevron-down" size={20} color="#6b7280" />}
            </Pressable>

            <Pressable
              style={[styles.selectInput, (!selectedCity || isLoadingDistricts) && styles.selectInputDisabled]}
              onPress={() => selectedCity && !isLoadingDistricts && setPickerType('district')}
              disabled={!selectedCity || isLoadingDistricts}
            >
              <Text style={selectedDistrict ? styles.selectValue : styles.selectPlaceholder}>
                {selectedDistrict?.ad || (!selectedCity ? 'Önce sehir seçin' : isLoadingDistricts ? 'İlçeler yukleniyor...' : 'İlçe seçin')}
              </Text>
              {isLoadingDistricts ? <ActivityIndicator size="small" color={APP_COLORS.secondary} /> : <Ionicons name="chevron-down" size={20} color="#6b7280" />}
            </Pressable>

            <Pressable
              style={[styles.selectInput, (!selectedDistrict || isLoadingNeighborhoods) && styles.selectInputDisabled]}
              onPress={() => selectedDistrict && !isLoadingNeighborhoods && setPickerType('neighborhood')}
              disabled={!selectedDistrict || isLoadingNeighborhoods}
            >
              <Text style={selectedNeighborhood ? styles.selectValue : styles.selectPlaceholder}>
                {selectedNeighborhood?.ad || (!selectedDistrict ? 'Önce ilçe seçin' : isLoadingNeighborhoods ? 'Mahalleler yükleniyor...' : 'Mahalle seçin')}
              </Text>
              {isLoadingNeighborhoods ? <ActivityIndicator size="small" color={APP_COLORS.secondary} /> : <Ionicons name="chevron-down" size={20} color="#6b7280" />}
            </Pressable>

            <Pressable style={styles.primaryButton} onPress={handleApplyFilter}>
              <Text style={styles.primaryButtonText}>Filtrele</Text>
            </Pressable>
          </View>
        ) : null}

        {selectedRegion ? (
          <View style={styles.statsSection}>
            {isLoadingStats ? (
              <View style={styles.loaderCard}>
                <ActivityIndicator size="large" color={APP_COLORS.secondary} />
                <Text style={styles.loaderText}>İstatistikler yükleniyor...</Text>
              </View>
            ) : null}

            {statsError ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>{statsError}</Text>
                <Pressable style={styles.retryButton} onPress={handleApplyFilter}>
                  <Text style={styles.retryButtonText}>Tekrar Dene</Text>
                </Pressable>
              </View>
            ) : null}

            {stats && !isLoadingStats ? (
              <>
                <View style={styles.statsGrid}>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Toplam Kullanıcı</Text>
                    <Text style={styles.statValue}>{stats.toplam_kullanici}</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Toplam İlan</Text>
                    <Text style={styles.statValue}>{stats.toplam_ilan}</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Toplam Yorum</Text>
                    <Text style={styles.statValue}>{stats.toplam_yorum}</Text>
                  </View>
                </View>

                <View style={styles.actionGroup}>
                  <Pressable
                    style={styles.actionButton}
                    onPress={() =>
                      navigation.navigate('AdminUsers', {
                        cityName: selectedRegion.city.ad,
                        districtName: selectedRegion.district.ad,
                        neighborhoodName: selectedRegion.neighborhood.ad,
                        neighborhoodId: selectedRegion.neighborhood.id,
                      })}
                  >
                    <Text style={styles.actionButtonText}>Kayıtlı Kullanıcıları Getir</Text>
                  </Pressable>
                  <Pressable
                    style={styles.actionButton}
                    onPress={() =>
                      navigation.navigate('AdminIlans', {
                        cityName: selectedRegion.city.ad,
                        districtName: selectedRegion.district.ad,
                        neighborhoodName: selectedRegion.neighborhood.ad,
                        neighborhoodId: selectedRegion.neighborhood.id,
                      })}
                  >
                    <Text style={styles.actionButtonText}>İlanları Getir</Text>
                  </Pressable>
                  <Pressable style={styles.secondaryButton} onPress={handleResetRegionSelection}>
                    <Text style={styles.secondaryButtonText}>Bölgeyi Değiştir</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <Modal transparent visible={pickerType !== null} animationType="fade" onRequestClose={() => setPickerType(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setPickerType(null)}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <Text style={styles.modalTitle}>{pickerTitle}</Text>
            <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent}>
              {pickerItems.length === 0 ? (
                <Text style={styles.emptyText}>Seçenek bulunamadı.</Text>
              ) : (
                pickerItems.map((item) => (
                  <Pressable
                    key={item.id}
                    style={styles.modalItem}
                    onPress={() => {
                      if (pickerType === 'city') {
                        void handleSelectCity(item as CityItem);
                        return;
                      }

                      if (pickerType === 'district') {
                        void handleSelectDistrict(item as DistrictItem);
                        return;
                      }

                      handleSelectNeighborhood(item as NeighborhoodItem);
                    }}
                  >
                    <Text style={styles.modalItemText}>{item.ad}</Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3efe7',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 36,
    gap: 16,
  },
  title: {
    marginLeft: 60,
    fontSize: 28,
    fontWeight: '800',
    color: '#1f2937',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: '#6b7280',
  },
  filterCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#eadfce',
    gap: 12,
  },

  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#95584a',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  regionText: {
    paddingLeft: 10,
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    lineHeight: 26,
  },
  selectInput: {
    minHeight: 50,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  selectInputDisabled: {
    opacity: 0.6,
  },
  selectValue: {
    flex: 1,
    color: '#111827',
    fontSize: 15,
  },
  selectPlaceholder: {
    flex: 1,
    color: '#9ca3af',
    fontSize: 15,
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: APP_COLORS.secondary,
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#1f2937',

  },
  secondaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  statsSection: {
    gap: 16,
  },
  loaderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#eadfce',
  },
  loaderText: {
    marginTop: 12,
    fontSize: 15,
    color: '#4b5563',
  },
  errorCard: {
    backgroundColor: '#fff1f2',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#fecdd3',
    gap: 12,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#be123c',
  },
  retryButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: APP_COLORS.secondary,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  statsGrid: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 20,
    borderWidth: 1,
    width: 150,
    borderColor: '#eadfce',
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: APP_COLORS.primary,
    marginBottom: 8,
  },
  statValue: {
    textAlign: 'center',
    fontSize: 30,
    fontWeight: '800',
    color: '#1f2937',
  },
  actionGroup: {
    gap: 12,
  },
  actionButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d7c8b4',
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    maxHeight: 420,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalList: {
    maxHeight: 340,
  },
  modalListContent: {
    gap: 8,
  },
  modalItem: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  modalItemText: {
    fontSize: 15,
    color: '#1f2937',
  },
  emptyText: {
    textAlign: 'center',
    color: '#6b7280',
    paddingVertical: 16,
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
});
