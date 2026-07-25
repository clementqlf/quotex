import { useRouter, useFocusEffect } from 'expo-router';
import { ArrowLeft, ArrowRight, Lock, Mail } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { useAuth } from '@/src/app/providers/AuthContext';
import {
  Alert,
  Dimensions,
  StyleSheet,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Animated,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { authService } from '@/src/entities/user/api/AuthService';
import { AppText, Button, IconButton, Input, Divider, Link, QuotexLogo } from '@/src/shared/ui';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const { colors, tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const styles = useMemo(() => createStyles(colors, tokens), [colors, tokens]);

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
            <IconButton
              variant="ghost"
              size="sm"
              icon={<ArrowLeft size={24} color={colors.text} />}
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
                  rightIcon={<ArrowRight size={20} color={colors.buttonText} />}
                  isLoading={isLoading}
                  disabled={isLoading}
                  onPress={handleContinue}
                  style={styles.loginButton}
                />

                <Divider text="ou" spacing="md" style={styles.dividerContainer} />

                <Button
                  title="Continuer avec Google"
                  variant="social"
                  onPress={() => handleSocialLogin('google')}
                  style={styles.socialButton}
                />
              </>
            ) : (
              <>
                <View style={styles.passwordHeader}>
                  <AppText variant="h1" weight="bold" style={{ marginBottom: 8 }}>
                    Ravi de vous revoir !
                  </AppText>
                  <AppText variant="body" color="secondary">
                    Renseignez votre mot de passe pour continuer.
                  </AppText>
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

                <Link
                  text="Mot de passe oublié ?"
                  onPress={handleForgotPassword}
                  style={styles.forgotPasswordContainer}
                  testID="forgot-password-link"
                  accessibilityLabel="Mot de passe oublié"
                />

                <Button
                  title="Se connecter"
                  rightIcon={<ArrowRight size={20} color={colors.buttonText} />}
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

const createStyles = (colors: any, tokens: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  topArea: {
    justifyContent: 'center',
    width: '100%',
  },
  backButton: {
    padding: tokens.spacing.sm,
    marginLeft: tokens.spacing.md,
    alignSelf: 'flex-start',
    width: tokens.sizes.md,
    height: tokens.sizes.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  passwordHeader: {
    marginBottom: tokens.spacing.lg,
  },
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginBottom: tokens.spacing.sm,
  },
  modalContainer: {
    flex: 1,
    borderTopLeftRadius: tokens.radii.xl,
    borderTopRightRadius: tokens.radii.xl,
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.xl,
    borderTopWidth: 1,
    borderColor: tokens.colors?.border || 'rgba(0,0,0,0.05)',
  },
  form: {
    gap: tokens.spacing.md,
  },
  inputContainer: {
    marginBottom: 0,
  },
  loginButton: {
    marginTop: tokens.spacing.sm,
  },
  dividerContainer: {
    marginVertical: tokens.spacing.md,
  },
  socialButton: {
    height: tokens.sizes.xl,
    borderRadius: tokens.radii.lg,
  },
});
