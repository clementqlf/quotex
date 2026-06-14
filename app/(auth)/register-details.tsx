import { useAuth } from '@/src/app/providers/AuthContext';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { authService } from '@/src/entities/user/api/AuthService';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, CheckCircle2, Lock, User as UserIcon, XCircle } from 'lucide-react-native';
import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';


export default function RegisterDetailsScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const { colors } = useTheme();
  const { register } = useAuth();

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
      // Vérification de l'unicité du nom d'utilisateur
      if (usernameAvailable !== true) {
        Alert.alert('Erreur', "Ce nom d'utilisateur n'est pas disponible. Veuillez en choisir un autre.");
        setIsLoading(false);
        return;
      }

      const response = await register(username, email!, password, name);
      
      if (response && response.token) {
        // Automatically signed in
        router.replace('/');
      } else {
        // Email confirmation is required, or no session returned
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <TouchableOpacity 
        style={styles.backButton} 
        onPress={() => router.back()}
      >
        <ArrowLeft size={24} color={colors.text} />
      </TouchableOpacity>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Bienvenue</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Créons votre compte pour {email}
            </Text>
          </View>

          <View style={styles.form}>
            <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <UserIcon size={20} color={colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Nom et prénom (ex: Jean Dupont)"
                placeholderTextColor={colors.textTertiary}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>

            <View style={[
              styles.inputContainer, 
              { backgroundColor: colors.surface, borderColor: colors.border },
              usernameAvailable === true && { borderColor: '#10B981' },
              usernameAvailable === false && { borderColor: '#EF4444' }
            ]}>
              <UserIcon size={20} color={colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Nom d'utilisateur (ex: @jean)"
                placeholderTextColor={colors.textTertiary}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
              {isCheckingUsername && (
                <ActivityIndicator size="small" color={colors.primary} />
              )}
              {usernameAvailable !== null && !isCheckingUsername && (
                <View style={styles.validationIcon}>
                  {usernameAvailable ? (
                    <CheckCircle2 size={18} color="#10B981" />
                  ) : (
                    <XCircle size={18} color="#EF4444" />
                  )}
                </View>
              )}
            </View>

            {usernameAvailable === false && (
              <Text style={styles.errorText}>
                {username.startsWith('@') && username.slice(1).length < 3 || username.length < 3 
                  ? "Le nom d'utilisateur doit contenir au moins 3 caractères"
                  : "Ce nom d'utilisateur est déjà utilisé"}
              </Text>
            )}

            <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Lock size={20} color={colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Mot de passe (6+ caractères)"
                placeholderTextColor={colors.textTertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <View style={[
              styles.inputContainer, 
              { backgroundColor: colors.surface, borderColor: colors.border },
              passwordsMatch && { borderColor: '#10B981' },
              passwordsMismatch && { borderColor: '#EF4444' }
            ]}>
              <Lock size={20} color={colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Confirmer le mot de passe"
                placeholderTextColor={colors.textTertiary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
              {password.length > 0 && confirmPassword.length > 0 && (
                <View style={styles.validationIcon}>
                  {passwordsMatch ? (
                    <CheckCircle2 size={18} color="#10B981" />
                  ) : (
                    <XCircle size={18} color="#EF4444" />
                  )}
                </View>
              )}
            </View>

            {passwordsMismatch && (
              <Text style={styles.errorText}>Les mots de passe ne correspondent pas</Text>
            )}

            <TouchableOpacity
              style={[
                styles.registerButton, 
                { backgroundColor: colors.primary },
                (!name || !username || !passwordsMatch || password.length < 6 || usernameAvailable !== true) && { opacity: 0.6 }
              ]}
              onPress={handleRegister}
              disabled={isLoading || !name || !username || !passwordsMatch || password.length < 6 || usernameAvailable !== true}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Text style={styles.registerButtonText}>Créer mon compte</Text>
                  <ArrowRight size={20} color="#FFF" style={styles.buttonIcon} />
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    flexGrow: 1,
    justifyContent: 'center',
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
    textAlign: 'left',
    lineHeight: 24,
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
  validationIcon: {
    marginLeft: 8,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: -8,
    marginLeft: 4,
  },
  registerButton: {
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
  registerButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  buttonIcon: {
    marginLeft: 8,
  },
});
