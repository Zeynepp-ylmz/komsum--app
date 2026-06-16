import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../store/auth/AuthContext';
import { AuthStackParamList } from '../../navigation/types';
import Ionicons from '@expo/vector-icons/Ionicons';
import { APP_COLORS } from '../../../theme/appColor';
import { CityItem, DistrictItem, getCities, getDistricts, getNeighborhoods, NeighborhoodItem } from '../../api/locations';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

type PickerType = 'city' | 'district' | 'neighborhood' | null;

export function RegisterScreen({ navigation }: Props) {
  const { register } = useAuth();
  const [ad, setAd] = useState('');
  const [soyad, setSoyad] = useState('');
  const [eposta, setEposta] = useState('');
  const [password, setPassword] = useState('');
  const [cities, setCities] = useState<CityItem[]>([]);
  const [districts, setDistricts] = useState<DistrictItem[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodItem[]>([]);
  const [selectedCity, setSelectedCity] = useState<CityItem | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictItem | null>(null);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<NeighborhoodItem | null>(null);
  const [pickerType, setPickerType] = useState<PickerType>(null);
  const [isLoadingCities, setIsLoadingCities] = useState(true);
  const [isLoadingDistricts, setIsLoadingDistricts] = useState(false);
  const [isLoadingNeighborhoods, setIsLoadingNeighborhoods] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const loadCities = async () => {
      try {
        setIsLoadingCities(true);
        const data = await getCities();
        setCities(data);
      } catch {
        Alert.alert('Hata', 'Şehirler Yüklenemedi.');
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
      Alert.alert('Hata', 'İlceler yüklenemedi.');
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

  const handleRegister = async () => {
    if (!ad || !soyad || !eposta || !password || !selectedNeighborhood) {
      Alert.alert('Eksik bilgi', 'Tüm alanları doldur.');
      return;
    }

    try {
      setIsSubmitting(true);
      await register({
        ad: ad.trim(),
        soyad: soyad.trim(),
        eposta: eposta.trim(),
        password,
        mahalle_id: selectedNeighborhood.id,
      });
      Alert.alert('Basarili', 'Kayıt olusturuldu. E-posta dogrulamasından sonra giriş yapabilirsin.');
      navigation.goBack();
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      const message = Array.isArray(detail) ? detail[0]?.msg : detail || 'Kayıt olusturulamadı.';
      Alert.alert('Hata', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const pickerItems = pickerType === 'city'
    ? cities
    : pickerType === 'district'
      ? districts
      : neighborhoods;

  const pickerTitle = pickerType === 'city'
    ? 'Şehir Seç'
    : pickerType === 'district'
      ? 'İlce Seç'
      : 'Mahalle Seç';

  const renderPickerItemLabel = (item: CityItem | DistrictItem | NeighborhoodItem) => item.ad;

  return (
    <>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.icon}>
          <Ionicons name="person-add" size={100} color="#d97706" />
        </View>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Kayıt Ol</Text>
          <Text style={styles.subtitle}>Hesap oluşturun ve komşularınızla yardımlaşın !</Text>
        </View>

        <View style={styles.form}>
          <TextInput placeholder="Adınız..." placeholderTextColor="#36383d" style={styles.input} value={ad} onChangeText={setAd} />
          <TextInput placeholder="Soyadınız..." placeholderTextColor="#36383d" style={styles.input} value={soyad} onChangeText={setSoyad} />
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="E-posta adresiniz..."
            placeholderTextColor="#36383d"
            style={styles.input}
            value={eposta}
            onChangeText={setEposta}
          />
          <TextInput
            placeholder="Şifreniz..."
            placeholderTextColor="#36383d"
            secureTextEntry
            style={styles.input}
            value={password}
            onChangeText={setPassword}
          />

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
              {selectedDistrict?.ad || (!selectedCity ? 'Once sehir secin' : isLoadingDistricts ? 'İlçeler yükleniyor...' : 'İlce seçin')}
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

          <Pressable style={styles.primaryButton} onPress={handleRegister} disabled={isSubmitting}>
            <Text style={styles.primaryButtonText}>{isSubmitting ? 'Kaydediliyor...' : 'Kayıt Ol'}</Text>
          </Pressable>

          <View style={styles.bottomContainer}>
            <Text>Zaten bir hesabınız var mı?</Text>
            <Pressable onPress={() => navigation.navigate('Login')}>
              <Text style={styles.linkText}>Giriş Yap</Text>
            </Pressable>
          </View>
        </View>
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
                    <Text style={styles.modalItemText}>{renderPickerItemLabel(item)}</Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: APP_COLORS.background,
  },
  title: {
    fontSize: 38,
    fontWeight: '700',
    textAlign: 'center',
    color: '#1f2937',
  },
  subtitle: {
    color: APP_COLORS.textsecondary,
    paddingHorizontal: 50,
    textAlign: 'center',
  },
  titleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  form: {
    gap: 12,
  },
  input: {
    width: 300,
    alignSelf: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  selectInput: {
    width: 300,
    minHeight: 48,
    alignSelf: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
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
    fontSize: 14,
  },
  selectPlaceholder: {
    flex: 1,
    color: '#9ca3af',
    fontSize: 14,
  },
  primaryButton: {
    width: 300,
    alignSelf: 'center',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: '#d97706',
    borderRadius: 12,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  bottomContainer: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkText: {
    fontWeight: 'bold',
    textAlign: 'center',
    paddingLeft: 8,
    textDecorationLine: 'underline',
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
});
