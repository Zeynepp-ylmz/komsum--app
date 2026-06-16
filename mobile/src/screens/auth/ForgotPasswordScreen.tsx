import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { forgotPassword } from '../../api/auth';
import { AuthStackParamList } from '../../navigation/types';
import { APP_COLORS } from '../../../theme/appColor';
import Ionicons from '@expo/vector-icons/Ionicons';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Eksik bilgi', 'E-posta adresini gir.');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await forgotPassword(email.trim());
      Alert.alert('Bilgi', response?.mesaj || 'Sifre sıfırlama linki gönderildi.');
      navigation.goBack();
    } catch (error: any) {
      const message = error?.response?.data?.detail || 'İstek gonderilemedi.';
      Alert.alert('Hata', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
        <Ionicons name="lock-open" size={70} color={APP_COLORS.primary} />
        <Text style={styles.title}>Şifreni mi unuttun?</Text>
        <Text style={styles.description}>
          E-posta adresini gir. Hesap kayıtlıysa şifre sıfırlama bağlantısı gönderilir.
        </Text>
      </View>


      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="E-posta adresin"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
      />

      <Pressable style={styles.primaryButton} onPress={handleForgotPassword} disabled={isSubmitting}>
        <Text style={styles.primaryButtonText}>
          {isSubmitting ? 'Gonderiliyor...' : 'Sıfırlama Linki Gönder'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: APP_COLORS.background,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    color: APP_COLORS.title,
    paddingTop: 20,
  },
  description: {
    textAlign: 'center',
    color: APP_COLORS.textsecondary,
    marginBottom: 8,
    lineHeight: 20,
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
  primaryButton: {
    width: 300,
    alignSelf: 'center',
    marginTop: 8,
    backgroundColor: APP_COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
