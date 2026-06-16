import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { createAd, deleteAd, getAdById, getCategories, CategoryItem, updateAd } from '../../api/ads';
import { AppStackParamList } from '../../navigation/types';
import { APP_COLORS } from '../../../theme/appColor';
import Entypo from '@expo/vector-icons/Entypo';
import AntDesign from '@expo/vector-icons/AntDesign';

const MAX_IMAGE_COUNT = 8;
const MAX_SINGLE_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;

type SelectedImage = {
  uri: string;
  name: string;
  type: string;
  fileSize?: number;
};

type ExistingImage = {
  id?: number;
  uri: string;
};

type Props = NativeStackScreenProps<AppStackParamList, 'IlanOlustur'>;

export function IlanOlusturScreen({ navigation, route }: Props) {
  const isEditMode = route.params?.mode === 'edit' && Boolean(route.params?.ad);
  const editingAd = route.params?.ad;
  const [baslik, setBaslik] = useState('');
  const [aciklama, setAciklama] = useState('');
  const [fiyat, setFiyat] = useState('');
  const [etiketlerText, setEtiketlerText] = useState('');
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CategoryItem | null>(null);
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isLoadingAd, setIsLoadingAd] = useState(isEditMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [categoryError, setCategoryError] = useState('');
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [existingImages, setExistingImages] = useState<ExistingImage[]>([]);
  const [removedImageIds, setRemovedImageIds] = useState<number[]>([]);


  useEffect(() => {
    const loadCategories = async () => {
      try {
        setIsLoadingCategories(true);
        setCategoryError('');
        const data = await getCategories();
        setCategories(data.filter((category) => category.ad.trim().toLowerCase() !== 'tümü' && category.ad.trim().toLowerCase() !== 'tumu'));
      } catch (error: any) {
        const message = error?.response?.data?.detail || 'Kategoriler yüklenemedi.';
        setCategoryError(message);
      } finally {
        setIsLoadingCategories(false);
      }
    };

    loadCategories();
  }, []);

  useEffect(() => {
    if (!isEditMode) {
      setBaslik('');
      setAciklama('');
      setFiyat('');
      setEtiketlerText('');
      setSelectedImages([]);
      setExistingImages([]);
      setRemovedImageIds([]);
      return;
    }

    if (!isEditMode || !editingAd?.id) {
      return;
    }

    const loadAd = async () => {
      try {
        setIsLoadingAd(true);
        setSelectedImages([]);
        setExistingImages([]);
        setRemovedImageIds([]);
        const ad = await getAdById(editingAd.id);
        setBaslik(ad.baslik);
        setAciklama(ad.aciklama);
        setFiyat(String(ad.fiyat ?? 0));
        setEtiketlerText((ad.etiketler ?? []).map((etiket) => etiket.ad).join(', '));
        setExistingImages(
          (ad.medyalar ?? []).map((media) => ({
            id: typeof media.id === 'number' ? media.id : undefined,
            uri: media.dosya_yolu,
          })),
        );
      } catch (error: any) {
        const message = error?.response?.data?.detail || 'İlan bilgileri yüklenemedi.';
        Alert.alert('Hata', message, [
          {
            text: 'Tamam',
            onPress: () => navigation.goBack(),
          },
        ]);
      } finally {
        setIsLoadingAd(false);
      }
    };

    loadAd();
  }, [editingAd?.id, isEditMode, navigation]);

  useEffect(() => {
    if (!categories.length) {
      return;
    }

    if (isEditMode && editingAd?.kategori?.id) {
      const matchedCategory = categories.find((category) => category.id === editingAd.kategori?.id) || null;
      setSelectedCategory(matchedCategory);
      return;
    }

    setSelectedCategory((current) => current);
  }, [categories, editingAd?.kategori?.id, isEditMode]);

  const handlePickImages = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('İzin Gerekli', 'Görsel secmek icin galeri izni vermelisin.');
      return;
    }

    const remainingSlots = MAX_IMAGE_COUNT - selectedImages.length - existingImages.length;
    if (remainingSlots <= 0) {
      Alert.alert('Limit Aşıldı', 'Bir ilana en fazla 8 görsel ekleyebilirsin.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      selectionLimit: remainingSlots,
      quality: 0.8,
      mediaTypes: ['images'],
    });

    if (result.canceled) {
      return;
    }

    const newImages: SelectedImage[] = result.assets.map((asset, index) => ({
      uri: asset.uri,
      name: asset.fileName || `ilan-gorsel-${Date.now()}-${index}.jpg`,
      type: asset.mimeType || 'image/jpeg',
      fileSize: asset.fileSize,
    }));

    for (const image of newImages) {
      if (image.fileSize && image.fileSize > MAX_SINGLE_IMAGE_SIZE_BYTES) {
        Alert.alert('Dosya Büyük', 'Tek dosya boyutu en fazla 5 MB olabilir.');
        return;
      }
    }

    const mergedImages = [...selectedImages, ...newImages];
    const totalSize = mergedImages.reduce((sum, image) => sum + (image.fileSize ?? 0), 0);
    if (totalSize > MAX_TOTAL_IMAGE_SIZE_BYTES) {
      Alert.alert('Dosya Büyük', 'Toplam dosya boyutu en fazla 20 MB olabilir.');
      return;
    }

    setSelectedImages(mergedImages);
  };

  const handleRemoveImage = (uri: string) => {
    setSelectedImages((current) => current.filter((image) => image.uri !== uri));
  };

  const handleRemoveExistingImage = (image: ExistingImage) => {
    if (typeof image.id !== 'number') {
      Alert.alert(
        'Eksik Backend Verisi',
        'Mevcut fotograf goruntulenebiliyor ama silinemiyor. Backend mevcut medya id bilgisini donmedigi icin silme istegi gonderilemiyor.',
      );
      return;
    }

    setExistingImages((current) => current.filter((currentImage) => currentImage.uri !== image.uri));
    setRemovedImageIds((current) => (current.includes(image.id!) ? current : [...current, image.id!]));
  };

  const handleSubmit = async () => {
    if (!baslik.trim() || !aciklama.trim() || !selectedCategory) {
      Alert.alert('Eksik Alan', 'Başlık, açıklama ve kategori zorunludur.');
      return;
    }

    const normalizedPrice = fiyat.trim() === '' ? 0 : Number(fiyat.replace(',', '.'));
    if (Number.isNaN(normalizedPrice)) {
      Alert.alert('Geçersiz Fiyat', 'Fiyat alanı sayısal bir değer olmalı.');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        baslik: baslik.trim(),
        aciklama: aciklama.trim(),
        fiyat: normalizedPrice,
        kategori_id: selectedCategory.id,
        etiketler: etiketlerText
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        files: selectedImages,
      };

      if (isEditMode && editingAd?.id) {
        await updateAd({
          adId: editingAd.id,
          ...payload,
          silinecek_medya_ids: removedImageIds,
        });
      } else {
        await createAd(payload);
      }

      Alert.alert('Başarılı', isEditMode ? 'İlan güncellendi.' : 'İlan oluşturuldu', [
        {
          text: 'Tamam',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error: any) {
      const message = error?.response?.data?.detail || (isEditMode ? 'İlan güncellenemedi.' : 'İlan oluşturulamadi.');
      Alert.alert('Hata', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAd = () => {
    if (!editingAd?.id) {
      return;
    }

    Alert.alert(
      'İlani Sil',
      'Bu ilanı silmek istediginize emin misiniz?',
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
    if (!editingAd?.id) {
      return;
    }

    try {
      setIsDeleting(true);
      await deleteAd(editingAd.id);
      Alert.alert('Başarılı', 'İlan silindi.', [
        {
          text: 'Tamam',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error: any) {
      const message = error?.response?.data?.detail || 'İlan silinemedi.';
      Alert.alert('Hata', message);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoadingAd) {
    return (
      <View style={styles.centeredState}>
        <ActivityIndicator size="large" color={APP_COLORS.secondary} />
        <Text style={styles.stateText}>İlan bilgileri yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', paddingLeft: 80 }}>
          <Text style={styles.title}>{isEditMode ? 'İlanı Düzenle' : 'İlan Oluştur'}</Text>
          {
            isEditMode ? (<AntDesign name="edit" size={24} color="black" />) : (<Entypo name="share" size={24} color="black" />)
          }
        </View>


      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.fieldBlock}>
          <Text style={styles.label}>Başlık</Text>
          <TextInput
            value={baslik}
            onChangeText={setBaslik}
            placeholder="İlan başlığını gir..."
            style={styles.input}
            placeholderTextColor="#9ca3af"
          />
        </View>

        <View style={styles.fieldBlock}>
          <Text style={styles.label}>Açıklama</Text>
          <TextInput
            value={aciklama}
            onChangeText={setAciklama}
            placeholder="İlan açıklamasını gir..."
            style={[styles.input, styles.textArea]}
            placeholderTextColor="#9ca3af"
            multiline
            textAlignVertical="top"
          />
        </View>

        <View style={styles.fieldBlock}>
          <Text style={styles.label}>Fiyat</Text>
          <TextInput
            value={fiyat}
            onChangeText={setFiyat}
            placeholder="0"
            style={styles.input}
            placeholderTextColor="#9ca3af"
            keyboardType="numeric"
          />
        </View>

        <View style={styles.fieldBlock}>
          <Text style={styles.label}>Kategori</Text>
          {isLoadingCategories ? (
            <View style={styles.stateBox}>
              <ActivityIndicator size="small" color={APP_COLORS.secondary} />
              <Text style={styles.stateText}>Kategoriler yükleniyor...</Text>
            </View>
          ) : categoryError ? (
            <View style={styles.stateBox}>
              <Text style={styles.errorText}>{categoryError}</Text>
            </View>
          ) : categories.length === 0 ? (
            <View style={styles.stateBox}>
              <Text style={styles.stateText}>Kategori bulunamadı.</Text>
            </View>
          ) : (
            <Pressable style={styles.selectButton} onPress={() => setIsCategoryModalVisible(true)}>
              <Text style={selectedCategory ? styles.selectText : styles.selectPlaceholder}>
                {selectedCategory ? selectedCategory.ad : 'Kategori seç'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#6b7280" />
            </Pressable>
          )}
        </View>

        <View style={styles.fieldBlock}>
          <Text style={styles.label}>Etiketler</Text>
          <TextInput
            value={etiketlerText}
            onChangeText={setEtiketlerText}
            placeholder="Örnek: tamir, bahçe, ikinci el"
            style={styles.input}
            placeholderTextColor="#9ca3af"
          />
          <Text style={styles.helperText}>Virgülle ayırarak birden fazla etiket girebilirsin.</Text>
        </View>

        <View style={styles.fieldBlock}>
          <Text style={styles.label}>Görseller</Text>
          <Pressable style={styles.imagePickerButton} onPress={handlePickImages}>
            <Ionicons name="images-outline" size={20} color={APP_COLORS.secondary} />
            <Text style={styles.imagePickerButtonText}>Galeriden görsel seç</Text>
          </Pressable>
          <Text style={styles.helperText}>En fazla 8 görsel. Tek görsel 5 MB, toplam 20 MB.</Text>

          {existingImages.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewRow}>
              {existingImages.map((image) => (
                <View key={`${image.id ?? 'existing'}-${image.uri}`} style={styles.previewCard}>
                  <Image source={{ uri: image.uri }} style={styles.previewImage} />
                  <Pressable style={styles.removeImageButton} onPress={() => handleRemoveExistingImage(image)}>
                    <Ionicons name="close" size={14} color="#ffffff" />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          ) : null}

          {selectedImages.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewRow}>
              {selectedImages.map((image) => (
                <View key={image.uri} style={styles.previewCard}>
                  <Image source={{ uri: image.uri }} style={styles.previewImage} />
                  <Pressable style={styles.removeImageButton} onPress={() => handleRemoveImage(image.uri)}>
                    <Ionicons name="close" size={14} color="#ffffff" />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          ) : null}
        </View>

        <Pressable style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]} onPress={handleSubmit} disabled={isSubmitting}>
          <Text style={styles.submitText}>
            {isSubmitting ? (isEditMode ? 'Güncelleniyor...' : 'Oluşturuluyor...') : (isEditMode ? 'Güncelle' : 'İlanı Oluştur')}
          </Text>
        </Pressable>

        {isEditMode ? (
          <Pressable
            style={[styles.deleteButton, isDeleting && styles.deleteButtonDisabled]}
            onPress={handleDeleteAd}
            disabled={isDeleting || isSubmitting}
          >
            <Text style={styles.deleteButtonText}>
              {isDeleting ? 'Siliniyor...' : 'İlanını Sil'}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <Modal
        transparent
        visible={isCategoryModalVisible}
        animationType="fade"
        onRequestClose={() => setIsCategoryModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsCategoryModalVisible(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Kategori Seç</Text>
            <ScrollView>
              {categories.map((category) => (
                <Pressable
                  key={category.id}
                  style={styles.modalItem}
                  onPress={() => {
                    setSelectedCategory(category);
                    setIsCategoryModalVisible(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{category.ad}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 58,
    paddingHorizontal: 16,
    paddingBottom: 16,
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
  title: {
    marginRight: 10,
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  fieldBlock: {
    gap: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  input: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#111827',
  },
  textArea: {
    height: 120,
    paddingTop: 14,
  },
  selectButton: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectText: {
    fontSize: 16,
    color: '#111827',
  },
  selectPlaceholder: {
    fontSize: 15,
    color: '#9ca3af',
  },
  helperText: {
    fontSize: 13,
    color: '#6b7280',
  },
  imagePickerButton: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  imagePickerButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: APP_COLORS.secondary,
  },
  previewRow: {
    gap: 12,
    paddingTop: 4,
  },
  previewCard: {
    position: 'relative',
  },
  previewImage: {
    width: 96,
    height: 96,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
  },
  removeImageButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(17, 24, 39, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: APP_COLORS.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  deleteButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: '#b91c1c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonDisabled: {
    opacity: 0.7,
  },
  deleteButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  stateBox: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stateText: {
    color: '#6b7280',
    fontSize: 14,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.35)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    maxHeight: '70%',
    borderRadius: 18,
    backgroundColor: '#ffffff',
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 12,
  },
  modalItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalItemText: {
    fontSize: 15,
    color: '#111827',
  },
});
