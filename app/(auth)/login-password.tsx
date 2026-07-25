import { useAuth } from '@/src/app/providers/AuthContext';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { authService } from '@/src/entities/user/api/AuthService';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, Lock, Mail } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Input } from '@/src/shared/ui';


export default function LoginPasswordScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const { colors } = useTheme();
  const { login } = useAuth();

  const [userEmail, setUserEmail] = useState(email || '');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!password) {
      Alert.alert('Erreur', 'Veuillez entrer votre mot de passe');
      return;
    }

    setIsLoading(true);
    try {
      await login(userEmail, password);
    } catch (error: any) {
      Alert.alert('Erreur de connexion', error.message || 'Identifiants incorrects');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!userEmail) {
      Alert.alert('Erreur', 'Veuillez entrer votre email');
      return;
    }
    
    try {
      await authService.resetPassword(userEmail);
      Alert.alert('Succès', 'Un email de réinitialisation a été envoyé.');
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible de envoyer l\'email de réinitialisation');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <TouchableOpacity 
        style={styles.backButton} 
        onPress={() => router.back()}
      >
        <ArrowLeft size={24} color={colors.text} />
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Bon retour</Text>
        </View>

        <View style={styles.form}>
          <Input
            leftIcon={<Mail size={20} color={colors.textTertiary} />}
            placeholder="Email"
            value={userEmail}
            onChangeText={setUserEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Input
            leftIcon={<Lock size={20} color={colors.textTertiary} />}
            placeholder="Mot de passe"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoFocus
          />

          <TouchableOpacity 
            style={styles.forgotPasswordContainer}
            onPress={handleForgotPassword}
          >
            <Text style={[styles.forgotPasswordText, { color: colors.primary }]}>
              Mot de passe oublié ?
            </Text>
          </TouchableOpacity>

          <Button
            title="Se connecter"
            rightIcon={<ArrowRight size={20} color="#FFF" />}
            isLoading={isLoading}
            disabled={isLoading}
            onPress={handleLogin}
            style={styles.loginButton}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButton: {
    padding: 16,
    zIndex: 10,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
  },
  header: {
    alignItems: 'flex-start',
    marginBottom: 40,
  },
  title: {
    fontSize: 42,
    fontWeight: '800',
    marginTop: 0,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginBottom: 8,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '600',
  },
  loginButton: {
    marginTop: 8,
  },
});
