import { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../store/auth/AuthContext';
import { AuthStackParamList } from '../../navigation/types';
import { APP_COLORS } from '../../../theme/appColor';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Eksik bilgi', 'E-posta ve sifre gerekli.');
      return;
    }

    try {
      setIsSubmitting(true);
      await login(email.trim(), password);
    } catch (error: any) {
      const message = error?.response?.data?.detail || 'Giris yapilamadi.';
      Alert.alert('Hata', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
        <Image source={require('../../../assets/komsumLogo.png')} style={styles.logo} />
      </View>
      <Text style={styles.title}>Hoş Geldiniz</Text>
      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="E-posta"
        placeholderTextColor="#36383d"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        placeholder="Şifre"
        placeholderTextColor="#36383d"
        secureTextEntry
        style={styles.input}
        value={password}
        onChangeText={setPassword}
      />
      <Pressable style={styles.forgotPasswordButton} onPress={() => navigation.navigate('ForgotPassword')}>
        <Text style={styles.forgotPasswordText}>Şifreni mi unuttun?</Text>
      </Pressable>
      <Pressable style={styles.primaryButton} onPress={handleLogin} disabled={isSubmitting}>
        <Text style={styles.primaryButtonText}>{isSubmitting ? 'Giriş Yapılıyor...' : 'Giriş Yap'}</Text>
      </Pressable>
      <View style={styles.bottomContainer}>

        <Text>Hesabın yok mu?</Text>
        <Pressable onPress={() => navigation.navigate('Register')}>
          <Text style={styles.linkText}>Kayıt ol</Text>
        </Pressable>

      </View>

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
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 16,
    color: APP_COLORS.title,
    textAlign: 'center',
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
    marginTop: 20,
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
  forgotPasswordButton: {
    width: 300,
    alignSelf: 'center',
    alignItems: 'flex-end',
    marginTop: -4,
  },
  forgotPasswordText: {
    color: APP_COLORS.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  bottomContainer: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  linkText: {
    fontWeight: 'bold',
    textAlign: 'center',
    paddingLeft: 10,
    textDecorationLine: 'underline',
    color: APP_COLORS.primary
  },
  logo: {
    height: 180,
    width: 180,
    borderRadius: 999,
    borderWidth: 1,
    elevation: 30,
    borderColor: 'black'
  }
});
