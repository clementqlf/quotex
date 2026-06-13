import { useRouter } from 'expo-router';
import { ArrowRight, Mail } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { authService } from '@/src/entities/user/api/AuthService';
import QuotexLogo from '@/src/shared/ui/QuotexLogo';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  React.useEffect(() => {
    GoogleSignin.configure({
      webClientId: '635592710276-llrsahmdofdbrbsc8kutih96brandjad.apps.googleusercontent.com',
      iosClientId: '635592710276-ejpo7l1bi3jkv6oh1hpd24clnudds1co.apps.googleusercontent.com',
      offlineAccess: true,
    });
  }, []);

  const handleContinue = async () => {
    if (!email) {
      Alert.alert('Erreur', 'Veuillez entrer votre email');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Erreur', 'Veuillez entrer un email valide');
      return;
    }

    setIsLoading(true);
    try {
      const exists = await authService.checkEmailExists(email);

      if (exists) {
        router.push({
          pathname: '/login-password',
          params: { email }
        });
      } else {
        router.push({
          pathname: '/register-details',
          params: { email }
        });
      }
    } catch (error: any) {
      console.error('Check email error:', error);
      Alert.alert('Erreur', 'Impossible de contacter le serveur. Veuillez vérifier votre connexion.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (platform: 'google' | 'apple') => {
    setIsLoading(true);
    try {
      if (platform === 'google') {
        await authService.signInWithGoogleNative();
        // Navigation handled by auth redirect in layout
      } else {
        // Apple est désactivé pour le moment
        Alert.alert('Information', 'La connexion avec Apple nécessite un compte développeur payant.');
      }
    } catch (error: any) {
      if (error.code !== 'ERR_CANCELED') {
        console.error(`${platform} login error:`, error);
        Alert.alert('Erreur', `La connexion avec ${platform} a échoué.`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <QuotexLogo width={SCREEN_WIDTH * 1.5} height={SCREEN_WIDTH * 1.5 * (150 / 400)} />
        </View>

        <View style={styles.form}>
          <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Mail size={20} color={colors.textTertiary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Email"
              placeholderTextColor={colors.textTertiary}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
              onSubmitEditing={handleContinue}
              autoFocus
              autoCorrect={false}
              spellCheck={false}
            />
          </View>

          <TouchableOpacity
            style={[styles.loginButton, { backgroundColor: colors.primary }]}
            onPress={handleContinue}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Text style={styles.loginButtonText}>Continuer</Text>
                <ArrowRight size={20} color="#FFF" style={styles.buttonIcon} />
              </>
            )}
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.textSecondary }]}>ou</Text>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          </View>

          <View style={styles.socialButtons}>
            <TouchableOpacity
              style={[styles.socialButton, { backgroundColor: isDark ? '#333' : '#F5F5F5', borderColor: colors.border }]}
              onPress={() => handleSocialLogin('google')}
            >

              <Text style={[styles.socialButtonText, { color: colors.text }]}>Continuer avec Google</Text>
            </TouchableOpacity>

            {/* 
            <TouchableOpacity 
              style={[styles.socialButton, { backgroundColor: isDark ? '#333' : '#F5F5F5', borderColor: colors.border }]}
              onPress={() => handleSocialLogin('apple')}
            >

              <Text style={[styles.socialButtonText, { color: colors.text }]}>Continuer avec Apple</Text>
            </TouchableOpacity>
            */}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40, // Push content slightly from top
  },
  header: {
    alignItems: 'center',
    marginBottom: 40, // Reduced from 80 to keep form higher
    marginHorizontal: -24,
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  loginButton: {
    height: 56,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  buttonIcon: {
    marginLeft: 8,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  divider: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    fontWeight: '500',
  },
  socialButtons: {
    gap: 12,
  },
  socialButton: {
    height: 56,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  socialButtonText: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '600',
  },
});
