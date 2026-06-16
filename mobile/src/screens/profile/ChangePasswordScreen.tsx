import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { APP_COLORS } from '../../../theme/appColor';
import { changePassword } from '../../api/users';
import { AppStackParamList } from '../../navigation/types';
import AntDesign from '@expo/vector-icons/AntDesign';

type Props = NativeStackScreenProps<AppStackParamList, 'ChangePassword'>;

function normalizeErrorMessage(detail: unknown, fallback: string) {
  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }

        if (item && typeof item === 'object' && 'msg' in item && typeof item.msg === 'string') {
          return item.msg;
        }

        return null;
      })
      .filter(Boolean);

    if (messages.length > 0) {
      return messages.join('\n');
    }
  }

  if (detail && typeof detail === 'object' && 'msg' in detail && typeof detail.msg === 'string') {
    return detail.msg;
  }

  return fallback;
}

export function ChangePasswordScreen({ navigation }: Props) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordRepeat, setNewPasswordRepeat] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPasswordError, setCurrentPasswordError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    const trimmedCurrentPassword = currentPassword.trim();
    const trimmedNewPassword = newPassword.trim();
    const trimmedNewPasswordRepeat = newPasswordRepeat.trim();

    if (!trimmedCurrentPassword || !trimmedNewPassword || !trimmedNewPasswordRepeat) {
      setCurrentPasswordError(null);
      setErrorMessage('Tum alanlari doldurmalisin.');
      return;
    }

    if (trimmedNewPassword !== trimmedNewPasswordRepeat) {
      setCurrentPasswordError(null);
      setErrorMessage('Yeni sifreler ayni olmali.');
      return;
    }

    try {
      setIsSubmitting(true);
      setCurrentPasswordError(null);
      setErrorMessage(null);
      const response = await changePassword({
        eski_sifre: trimmedCurrentPassword,
        yeni_sifre: trimmedNewPassword,
      });

      Alert.alert('Basarili', response.mesaj || 'Sifreniz guncellendi.', [
        {
          text: 'Tamam',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error: any) {
      const message = normalizeErrorMessage(error?.response?.data?.detail, 'Sifre guncellenemedi.');

      if (message === 'Eski şifreniz hatalı.') {
        setCurrentPasswordError(message);
        setErrorMessage(null);
      } else {
        setCurrentPasswordError(null);
        setErrorMessage(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.contentContainer} style={styles.container}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </Pressable>

        <View style={{ flexDirection: 'row', alignItems: 'baseline', paddingLeft: 40 }}>
          <Text style={styles.title}>Şifreni Değiştir</Text>
          <AntDesign name="edit" size={28} color="black" />
        </View>
      </View>



      <View style={styles.card}>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Mevcut Şifre</Text>
          <TextInput
            value={currentPassword}
            onChangeText={(value) => {
              setCurrentPassword(value);
              if (currentPasswordError) {
                setCurrentPasswordError(null);
              }
            }}
            style={styles.input}
            placeholder="Mevcut şifreni gir..."
            placeholderTextColor="#9ca3af"
            secureTextEntry
            editable={!isSubmitting}
          />
          {currentPasswordError ? <Text style={styles.fieldErrorText}>{currentPasswordError}</Text> : null}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Yeni Şifre</Text>
          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            style={styles.input}
            placeholder="Yeni şifreni gir..."
            placeholderTextColor="#9ca3af"
            secureTextEntry
            editable={!isSubmitting}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Yeni Şifre Tekrar</Text>
          <TextInput
            value={newPasswordRepeat}
            onChangeText={setNewPasswordRepeat}
            style={styles.input}
            placeholder="Yeni şifreyi tekrar gir..."
            placeholderTextColor="#9ca3af"
            secureTextEntry
            editable={!isSubmitting}
          />
        </View>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        <Pressable style={[styles.button, isSubmitting && styles.buttonDisabled]} onPress={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>Şifreyi Güncelle</Text>
          )}
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
    paddingTop: 58,
    paddingBottom: 32,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingBottom: 16,
    paddingTop: 10
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
  fieldErrorText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
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
});
