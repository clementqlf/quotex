import { useAuth } from '@/src/app/providers/AuthContext';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { authService } from '@/src/entities/user/api/AuthService';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, CheckCircle2, Lock, User as UserIcon, XCircle } from 'lucide-react-native';
import React, { useState, useEffect } from 'react';
import { DEFAULT_HIT_SLOP } from '@/src/shared/lib/pressUtils';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  View,
  Animated
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Input } from '@/src/shared/ui';


export default function RegisterDetailsScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const { colors } = useTheme();
  const { register } = useAuth();
  const insets = useSafeAreaInsets();

  const [slideAnim] = useState(() => new Animated.Value(600));

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 50,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [slideAnim]);

  const handleBack = () => {
    Animated.timing(slideAnim, {
      toValue: 600,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      router.back();
    });
  };

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);

  const [prevUsername, setPrevUsername] = useState<string>('');
  if (username !== prevUsername) {
    setPrevUsername(username);
    if (!username) {
      setUsernameAvailable(null);
      setIsCheckingUsername(false);
    } else {
      const clean = username.startsWith('@') ? username.slice(1) : username;
      if (clean.length < 3) {
        setUsernameAvailable(false);
        setIsCheckingUsername(false);
      } else {
        setIsCheckingUsername(true);
      }
    }
  }

  useEffect(() => {
    if (!username) {
      return;
    }

    const clean = username.startsWith('@') ? username.slice(1) : username;
    if (clean.length < 3) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const exists = await authService.checkUsernameExists(clean);
        setUsernameAvailable(!exists);
      } catch (err) {
        console.error(err);
        setUsernameAvailable(null);
      } finally {
        setIsCheckingUsername(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [username]);

  const passwordsMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = password.length > 0 && confirmPassword.length > 0 && password !== confirmPassword;

  const handleRegister = async () => {
    if (!name || !username || !password || !confirmPassword) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setIsLoading(true);
    try {
      if (usernameAvailable !== true) {
        Alert.alert('Erreur', "Ce nom d'utilisateur n'est pas disponible. Veuillez en choisir un autre.");
        setIsLoading(false);
        return;
      }

      const response = await register(username, email!, password, name);
      
      if (response && response.token) {
        router.replace('/');
      } else {
        Alert.alert(
          "Compte créé !",
          "Votre compte a été créé avec succès. Un e-mail de confirmation vous a été envoyé. Veuillez confirmer votre adresse e-mail avant de vous connecter.",
          [
            { 
              text: "Se connecter", 
              onPress: () => router.replace('/login')
            }
          ]
        );
      }
    } catch (error: any) {
      Alert.alert("Erreur lors de l'inscription", error.message || "Impossible de créer le compte");
    } finally {
      setIsLoading(false);
    }
  };

  const renderUsernameRightIcon = () => {
    if (isCheckingUsername) {
      return <ActivityIndicator size="small" color={colors.primary} />;
    }
    if (usernameAvailable !== null && !isCheckingUsername) {
      return usernameAvailable ? (
        <CheckCircle2 size={18} color="#10B981" />
      ) : (
        <XCircle size={18} color="#EF4444" />
      );
    }
    return null;
  };

  const renderPasswordRightIcon = () => {
    if (password.length > 0 && confirmPassword.length > 0) {
      return passwordsMatch ? (
        <CheckCircle2 size={18} color="#10B981" />
      ) : (
        <XCircle size={18} color="#EF4444" />
      );
    }
    return null;
  };

  const isRegisterDisabled = !name || !username || !passwordsMatch || password.length < 6 || usernameAvailable !== true || isLoading;

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <SafeAreaView style={styles.topArea} edges={['top', 'left', 'right']}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={handleBack}
            hitSlop={DEFAULT_HIT_SLOP}
            activeOpacity={0.7}
          >
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
        </SafeAreaView>

        <Animated.View style={[
          styles.modalContainer,
          {
            backgroundColor: colors.surface,
            paddingBottom: Math.max(insets.bottom, 24) + 16,
            transform: [{ translateY: slideAnim }],
          }
        ]}>
          <ScrollView 
            showsVerticalScrollIndicator={false} 
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Bienvenue à bord !</Text>
              <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                Créons votre compte pour {email}
              </Text>
            </View>

            <View style={styles.form}>
              <Input
                leftIcon={<UserIcon size={20} color={colors.textTertiary} />}
                placeholder="Nom et prénom (ex: Jean Dupont)"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />

              <Input
                leftIcon={<UserIcon size={20} color={colors.textTertiary} />}
                rightIcon={renderUsernameRightIcon()}
                placeholder="Nom d'utilisateur (ex: @jean)"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                error={usernameAvailable === false ? 
                  (username.startsWith('@') && username.slice(1).length < 3 || username.length < 3 
                    ? "Le nom d'utilisateur doit contenir au moins 3 caractères"
                    : "Ce nom d'utilisateur est déjà utilisé") : undefined
                }
              />

              <Input
                leftIcon={<Lock size={20} color={colors.textTertiary} />}
                placeholder="Mot de passe (6+ caractères)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              <Input
                leftIcon={<Lock size={20} color={colors.textTertiary} />}
                rightIcon={renderPasswordRightIcon()}
                placeholder="Confirmer le mot de passe"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                error={passwordsMismatch ? "Les mots de passe ne correspondent pas" : undefined}
              />

              <Button
                title="Créer mon compte"
                rightIcon={<ArrowRight size={20} color="#FFF" />}
                isLoading={isLoading}
                disabled={isRegisterDisabled}
                onPress={handleRegister}
                style={isRegisterDisabled ? [styles.registerButton, { opacity: 0.6 }] : styles.registerButton}
              />
            </View>
          </ScrollView>
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
    paddingBottom: 8,
    paddingHorizontal: 24,
    alignItems: 'flex-start',
    justifyContent: 'center',
    minHeight: 56,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    flexGrow: 1,
  },
  header: {
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 16,
    textAlign: 'left',
    lineHeight: 24,
    marginBottom: 0,
  },
  modalContainer: {
    flex: 1,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
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
  registerButton: {
    marginTop: 8,
  },
});
