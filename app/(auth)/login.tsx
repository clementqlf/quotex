import { useRouter, useFocusEffect } from 'expo-router';
import { ArrowLeft, ArrowRight, Lock, Mail } from 'lucide-react-native';
import React, { useState } from 'react';
import { useAuth } from '@/src/app/providers/AuthContext';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  StyleSheet,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Animated,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { authService } from '@/src/entities/user/api/AuthService';
import QuotexLogo from '@/src/shared/ui/QuotexLogo';
import { Button, Input, Divider } from '@/src/shared/ui';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();

  const [step, setStep] = useState<'email' | 'password'>('email');
  const [anim] = useState(() => new Animated.Value(0));
  const [slideAnim] = useState(() => new Animated.Value(600));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  React.useEffect(() => {
    GoogleSignin.configure({
      webClientId: '635592710276-llrsahmdofdbrbsc8kutih96brandjad.apps.googleusercontent.com',
      iosClientId: '635592710276-ejpo7l1bi3jkv6oh1hpd24clnudds1co.apps.googleusercontent.com',
      offlineAccess: true,
    });
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }).start();
    }, [slideAnim])
  );

  const handleContinue = async () => {
    if (!email) {
      Alert.alert('Erreur', 'Veuillez entrer votre email');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Erreur', 'Veuillez entrer un email valide');
      return;
    }

    setIsLoading(true);
    try {
      const exists = await authService.checkEmailExists(email);

      if (exists) {
        Animated.timing(slideAnim, {
          toValue: 600,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          setStep('password');
          anim.setValue(1);
          Animated.spring(slideAnim, {
            toValue: 0,
            tension: 50,
            friction: 8,
            useNativeDriver: true,
          }).start();
        });
      } else {
        Animated.timing(slideAnim, {
          toValue: 600,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          router.push({
            pathname: '/register-details',
            params: { email }
          });
        });
      }
    } catch (error: any) {
      console.error('Check email error:', error);
      Alert.alert('Erreur', 'Impossible de contacter le serveur. Veuillez vérifier votre connexion.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!password) {
      Alert.alert('Erreur', 'Veuillez entrer votre mot de passe');
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
    } catch (error: any) {
      Alert.alert('Erreur de connexion', error.message || 'Identifiants incorrects');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert('Erreur', 'Veuillez entrer votre email');
      return;
    }
    
    try {
      await authService.resetPassword(email);
      Alert.alert('Succès', 'Un email de réinitialisation a été envoyé.');
    } catch (error: any) {
      Alert.alert('Erreur', error.message || "Impossible d'envoyer l'email de réinitialisation");
    }
  };

  const handleBack = () => {
    Animated.timing(slideAnim, {
      toValue: 600,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setStep('email');
      anim.setValue(0);
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleSocialLogin = async (platform: 'google' | 'apple') => {
    setIsLoading(true);
    try {
      if (platform === 'google') {
        await authService.signInWithGoogleNative();
      } else {
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
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <Animated.View style={[
          styles.topArea, 
          {
            height: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [220 + insets.top, 56 + insets.top]
            }),
            paddingTop: insets.top,
          }
        ]}>
          {step === 'password' ? (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<ArrowLeft size={24} color={colors.text} />}
              onPress={handleBack}
              style={styles.backButton}
            />
          ) : (
            <View style={styles.header}>
              <QuotexLogo width={SCREEN_WIDTH * 1.2} height={SCREEN_WIDTH * 1.2 * (150 / 400)} />
            </View>
          )}
        </Animated.View>

        <Animated.View style={[
          styles.modalContainer, 
          { 
            backgroundColor: colors.surface,
            paddingBottom: Math.max(insets.bottom, 24) + 16,
            transform: [{ translateY: slideAnim }],
          }
        ]}>
          <View style={styles.form}>
            {step === 'email' ? (
              <>
                <Input
                  leftIcon={<Mail size={20} color={colors.textTertiary} />}
                  placeholder="Email"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  returnKeyType="next"
                  onSubmitEditing={handleContinue}
                  autoCorrect={false}
                  spellCheck={false}
                  containerStyle={styles.inputContainer}
                />

                <Button
                  title="Continuer"
                  rightIcon={<ArrowRight size={20} color="#FFF" />}
                  isLoading={isLoading}
                  disabled={isLoading}
                  onPress={handleContinue}
                  style={styles.loginButton}
                />

                <Divider text="ou" spacing="md" style={styles.dividerContainer} />

                <Button
                  title="Continuer avec Google"
                  variant="secondary"
                  onPress={() => handleSocialLogin('google')}
                  style={[
                    styles.socialButton,
                    { 
                      backgroundColor: isDark ? '#333' : '#F5F5F5', 
                      borderColor: colors.border 
                    }
                  ]}
                />
              </>
            ) : (
              <>
                <View style={styles.passwordHeader}>
                  <Text style={[styles.modalTitle, { color: colors.text, marginBottom: 8 }]}>
                    Ravi de vous revoir !
                  </Text>
                  <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                    Renseignez votre mot de passe pour continuer.
                  </Text>
                </View>

                <Input
                  leftIcon={<Mail size={20} color={colors.textTertiary} />}
                  value={email}
                  editable={false}
                  containerStyle={styles.inputContainer}
                  inputContainerStyle={{ opacity: 0.6 }}
                />

                <Input
                  leftIcon={<Lock size={20} color={colors.textTertiary} />}
                  placeholder="Mot de passe"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  onSubmitEditing={handleLogin}
                  containerStyle={styles.inputContainer}
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
              </>
            )}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topArea: {
    justifyContent: 'center',
    width: '100%',
  },
  backButton: {
    padding: 8,
    marginLeft: 16,
    alignSelf: 'flex-start',
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 16,
    lineHeight: 24,
  },
  passwordHeader: {
    marginBottom: 20,
  },
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginBottom: 8,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    marginBottom: 0,
  },
  loginButton: {
    marginTop: 8,
  },
  dividerContainer: {
    marginVertical: 20,
  },
  socialButton: {
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
  },
});
