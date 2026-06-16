import AntDesign from '@expo/vector-icons/AntDesign';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppStackParamList } from '../../navigation/types';
import { APP_COLORS } from '../../../theme/appColor';
import {
  getCurrentUser,
  removeProfileImage,
  uploadProfileImage,
  updateCurrentUser,
} from '../../api/users';

type Props = NativeStackScreenProps<AppStackParamList, 'EditProfile'>;

type SelectedImage = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

export function EditProfileScreen({ navigation }: Props) {
  const [ad, setAd] = useState('');
  const [soyad, setSoyad] = useState('');
  const [eposta, setEposta] = useState('');
  const [initialEposta, setInitialEposta] = useState('');
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [isProfileImageCleared, setIsProfileImageCleared] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setIsLoading(true);
        setErrorMessage(null);

        const user = await getCurrentUser();
        setAd(user.ad);
        setSoyad(user.soyad);
        setEposta(user.eposta);
        setInitialEposta(user.eposta);
        setCurrentImage(user.profile_image);
        setIsProfileImageCleared(false);
      } catch (error: any) {
        setErrorMessage(error?.response?.data?.detail || 'Profil bilgileri yuklenemedi.');
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handlePickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Izin Gerekli', 'Profil resmi secmek icin galeri izni vermen gerekiyor.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const asset = result.assets[0];
    setIsProfileImageCleared(false);
    setSelectedImage({
      uri: asset.uri,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
    });
  };

  const handleRemoveProfileImage = () => {
    setSelectedImage(null);
    setIsProfileImageCleared(true);
  };

  const handleSave = async () => {
    const trimmedAd = ad.trim();
    const trimmedSoyad = soyad.trim();
    const trimmedEposta = eposta.trim();
    const emailChanged = trimmedEposta.toLowerCase() !== initialEposta.trim().toLowerCase();

    if (!trimmedAd || !trimmedSoyad || !trimmedEposta) {
      setErrorMessage('Ad, soyad ve e-posta bos birakilamaz.');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);

      await updateCurrentUser({
        ad: trimmedAd,
        soyad: trimmedSoyad,
        eposta: trimmedEposta,
      });

      if (selectedImage) {
        await uploadProfileImage(selectedImage);
      } else if (isProfileImageCleared) {
        await removeProfileImage();
      }

      const refreshedUser = await getCurrentUser();
      setCurrentImage(refreshedUser.profile_image);
      setSelectedImage(null);
      setIsProfileImageCleared(false);

      if (emailChanged) {
        Alert.alert(
          'Bilgi',
          'Doğrulama maili yeni e-posta adresinize gönderildi. Doğrulanana kadar eski e-posta geçerli kalır.',
          [
            {
              text: 'Tamam',
              onPress: () => navigation.navigate('Tabs'),
            },
          ],
        );
        return;
      }

      Alert.alert('Başarılı', 'Profil güncellendi', [
        {
          text: 'Tamam',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.detail || 'Profil guncellenemedi.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centeredState}>
        <ActivityIndicator size="large" color={APP_COLORS.secondary} />
        <Text style={styles.stateText}>Profil duzenleme formu yukleniyor...</Text>
      </View>
    );
  }

  const previewImage = isProfileImageCleared ? null : selectedImage?.uri || currentImage;

  return (
    <ScrollView contentContainerStyle={styles.contentContainer} style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Profilini Düzenle</Text>
        <AntDesign name="edit" size={24} color="#111827" />
      </View>

      <View style={styles.card}>
        <View style={styles.avatarSection}>
          {previewImage ? (
            <Image source={{ uri: previewImage }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarFallbackText}>
                {[ad, soyad]
                  .map((value) => value.trim().charAt(0).toUpperCase())
                  .filter(Boolean)
                  .join('')
                  .slice(0, 2) || '?'}
              </Text>
            </View>
          )}

          <View style={styles.avatarActionsRow}>
            <Pressable style={styles.secondaryButton} onPress={handlePickImage}>
              <Text style={styles.secondaryButtonText}>Galeriden Seç</Text>
            </Pressable>

            <Pressable style={styles.removeButton} onPress={handleRemoveProfileImage}>
              <Text style={styles.removeButtonText}>Profili Kaldır</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Ad</Text>
          <TextInput
            value={ad}
            onChangeText={setAd}
            style={styles.input}
            placeholder="Ad"
            placeholderTextColor="#9ca3af"
            editable={!isSaving}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Soyad</Text>
          <TextInput
            value={soyad}
            onChangeText={setSoyad}
            style={styles.input}
            placeholder="Soyad"
            placeholderTextColor="#9ca3af"
            editable={!isSaving}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>E-posta</Text>
          <TextInput
            value={eposta}
            onChangeText={setEposta}
            style={styles.input}
            placeholder="ornek@gmail.com"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!isSaving}
          />
        </View>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        <Pressable style={[styles.button, isSaving && styles.buttonDisabled]} onPress={handleSave} disabled={isSaving}>
          {isSaving ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>Kaydet</Text>
          )}
        </Pressable>

        <Pressable style={styles.cancelButton} onPress={() => navigation.goBack()} disabled={isSaving}>
          <Text style={styles.cancelButtonText}>Vazgeç</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f3efe7',
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 72,
    paddingBottom: 32,
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
    textAlign: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  title: {
    marginRight: 10,
    fontSize: 30,
    fontWeight: '800',
    color: '#1f2937',
    marginBottom: 18,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: '#eadfce',
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarImage: {
    width: 108,
    height: 108,
    borderRadius: 54,
    marginBottom: 14,
  },
  avatarFallback: {
    width: 108,
    height: 108,
    borderRadius: 54,
    marginBottom: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: APP_COLORS.primary,
  },
  avatarFallbackText: {
    color: '#ffffff',
    fontSize: 34,
    fontWeight: '800',
  },
  avatarActionsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  secondaryButton: {
    marginRight: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#f6eadf',
  },
  secondaryButtonText: {
    color: APP_COLORS.secondary,
    fontSize: 14,
    fontWeight: '700',
  },
  removeButton: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#f6eadf',
  },
  removeButtonText: {
    color: APP_COLORS.secondary,
    fontSize: 14,
    fontWeight: '700',
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fffaf3',
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#111827',
  },
  errorText: {
    marginBottom: 16,
    fontSize: 15,
    lineHeight: 22,
    color: '#b91c1c',
  },
  button: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: APP_COLORS.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelButton: {
    marginTop: 12,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 15,
    fontWeight: '700',
  },
});
