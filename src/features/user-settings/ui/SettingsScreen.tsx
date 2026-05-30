import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { 
  ChevronLeft, LogOut, Bell, Shield, Moon, CircleHelp, User, Lock, 
  CheckCircle2, XCircle, Database, Trash2, FileText 
} from 'lucide-react-native';
import { Image as ExpoImage } from 'expo-image';
import { useAuth } from '@/src/app/providers/AuthContext';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { ThemeColors } from '@/src/shared/theme';
import { useQuote } from '@/src/entities/quote/providers/QuoteProvider';
import { useAuthor } from '@/src/entities/author/providers/AuthorProvider';
import { StorageService, STORAGE_KEYS } from '@/src/shared/api/StorageService';
import * as FileSystem from 'expo-file-system/legacy';
import * as WebBrowser from 'expo-web-browser';

export default function SettingsScreen() {
  const router = useRouter();
  const { logout, deleteAccount, user, updateProfile } = useAuth();
  const { isDark, colors } = useTheme();
  const { refreshQuotes } = useQuote();
  const { refreshAuthors, refreshBooks } = useAuthor();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [isUpdating, setIsUpdating] = React.useState(false);
  const [isPasswordModalVisible, setIsPasswordModalVisible] = React.useState(false);
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');

  const handleUpdateUsername = () => {
    Alert.prompt(
      "Modifier le nom d'utilisateur",
      "Entrez votre nouveau nom d'utilisateur (commençant par @)",
      [
        { text: "Annuler", style: "cancel" },
        { 
          text: "Enregistrer", 
          onPress: async (newUsername: string | undefined) => {
            if (!newUsername) return;
            setIsUpdating(true);
            try {
              await updateProfile({ username: newUsername });
              Alert.alert("Succès", "Votre nom d'utilisateur a été mis à jour.");
            } catch (error: any) {
              Alert.alert("Erreur", error.message || "Échec de la mise à jour");
            } finally {
              setIsUpdating(false);
            }
          } 
        }
      ],
      'plain-text',
      user?.username
    );
  };

  const handleSavePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert("Erreur", "Le mot de passe doit faire au moins 6 caractères.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Erreur", "Les mots de passe ne correspondent pas.");
      return;
    }

    setIsUpdating(true);
    try {
      await updateProfile({ password: newPassword });
      Alert.alert("Succès", "Votre mot de passe a été mis à jour.");
      setIsPasswordModalVisible(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      Alert.alert("Erreur", error.message || "Échec de la mise à jour");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Déconnexion",
      "Êtes-vous sûr de vouloir vous déconnecter ?",
      [
        { text: "Annuler", style: "cancel" },
        { 
          text: "Se déconnecter", 
          style: "destructive", 
          onPress: async () => {
            try {
              await logout();
              router.replace('/login');
            } catch (error) {
              console.error("Logout error", error);
            }
          } 
        }
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Supprimer mon compte",
      "Êtes-vous sûr de vouloir supprimer définitivement votre compte et toutes vos citations ? Cette action est irréversible.",
      [
        { text: "Annuler", style: "cancel" },
        { 
          text: "Supprimer", 
          style: "destructive", 
          onPress: async () => {
            try {
              setIsUpdating(true);
              await deleteAccount();
              router.replace('/login');
            } catch (error: any) {
              console.error("Delete account error", error);
              Alert.alert("Erreur", error.message || "Impossible de supprimer le compte.");
            } finally {
              setIsUpdating(false);
            }
          } 
        }
      ]
    );
  };

  const handleClearCache = () => {
    Alert.alert(
      "Vider le cache",
      "Cela va vider tout le cache de l'application (images, données locales et fichiers temporaires). Les données seront re-téléchargées lors de votre prochaine visite.",
      [
        { text: "Annuler", style: "cancel" },
        { 
          text: "Vider", 
          style: "destructive", 
          onPress: async () => {
            try {
              // 1. Clear ExpoImage caches
              await ExpoImage.clearDiskCache();
              await ExpoImage.clearMemoryCache();

              // 2. Clear FileSystem cacheDirectory
              const cacheDir = FileSystem.cacheDirectory;
              if (cacheDir) {
                const files = await FileSystem.readDirectoryAsync(cacheDir);
                for (const file of files) {
                  await FileSystem.deleteAsync(cacheDir + file, { idempotent: true }).catch(() => {});
                }
              }

              // 3. Clear AsyncStorage cached data keys
              await StorageService.removeItem(STORAGE_KEYS.QUOTES);
              await StorageService.removeItem(STORAGE_KEYS.AUTHORS);
              await StorageService.removeItem(STORAGE_KEYS.BOOKS);
              await StorageService.removeItem(STORAGE_KEYS.BLOCK_LAYOUTS);
              await StorageService.removeItem(STORAGE_KEYS.BLOCK_DATA);
              await StorageService.removeItem(STORAGE_KEYS.USER_DATA);

              // 4. Force data refresh in the provider to synchronize memory state
              await Promise.all([
                refreshQuotes(),
                refreshAuthors(),
                refreshBooks()
              ]);

              Alert.alert("Succès", "Le cache de l'application a été vidé.");
            } catch (error) {
              console.error("Clear cache error", error);
              Alert.alert("Erreur", "Impossible de vider le cache.");
            }
          } 
        }
      ]
    );
  };

  const SettingItem = ({ icon: Icon, title, value, type = 'chevron', onPress }: any) => (
    <TouchableOpacity 
      style={styles.settingItem} 
      onPress={onPress}
      disabled={type === 'switch'}
    >
      <View style={styles.settingItemLeft}>
        <View style={styles.iconContainer}>
          <Icon size={20} color={colors.primary} />
        </View>
        <Text style={styles.settingItemTitle}>{title}</Text>
      </View>
      
      {type === 'chevron' && <ChevronLeft size={20} color={colors.textTertiary} style={{ transform: [{ rotate: '180deg' }] }} />}
      {type === 'switch' && (
        <Switch 
          value={value} 
          onValueChange={onPress}
          trackColor={{ false: '#767577', true: colors.primary }}
          thumbColor={value ? '#FFFFFF' : '#f4f3f4'}
        />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Paramètres</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Account Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Compte</Text>
            <View style={styles.sectionCard}>
              <SettingItem 
                icon={User} 
                title="Nom d'utilisateur" 
                onPress={handleUpdateUsername} 
              />
              <SettingItem 
                icon={Lock} 
                title="Mot de passe" 
                onPress={() => setIsPasswordModalVisible(true)} 
              />
              <SettingItem 
                icon={Bell} 
                title="Notifications" 
                onPress={() => {}} 
              />
              <SettingItem 
                icon={Trash2} 
                title="Supprimer mon compte" 
                onPress={handleDeleteAccount} 
              />
            </View>
          </View>

          {/* App Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Application</Text>
            <View style={styles.sectionCard}>
              <SettingItem 
                icon={Moon} 
                title="Mode Sombre" 
                type="switch"
                value={isDark}
                onPress={() => {}} // Hook theme toggle here if available
              />
              <SettingItem 
                icon={CircleHelp} 
                title="Aide & Support" 
                onPress={() => {}} 
              />
            </View>
          </View>

          {/* Storage Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Stockage et Données</Text>
            <View style={styles.sectionCard}>
              <SettingItem 
                icon={Trash2} 
                title="Vider le cache" 
                onPress={handleClearCache} 
              />
            </View>
            <Text style={styles.sectionFooter}>
              Libérez de l'espace en supprimant les images, données locales et fichiers temporaires.
            </Text>
          </View>

          {/* Legal Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Légal</Text>
            <View style={styles.sectionCard}>
              <SettingItem 
                icon={FileText} 
                title="Conditions Générales d'Utilisation" 
                onPress={() => WebBrowser.openBrowserAsync('https://clementqlf.github.io/quotex/docs/CGU.html')} 
              />
              <SettingItem 
                icon={Shield} 
                title="Politique de Confidentialité" 
                onPress={() => WebBrowser.openBrowserAsync('https://clementqlf.github.io/quotex/docs/confidentialite.html')} 
              />
            </View>
          </View>

          {/* Spacer */}
          <View style={{ flex: 1, minHeight: 40 }} />

          {/* Logout Button */}
          <TouchableOpacity 
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <LogOut size={20} color="#FF4B4B" />
            <Text style={styles.logoutText}>Déconnexion</Text>
          </TouchableOpacity>

          <Text style={styles.versionText}>Version 1.0.0</Text>
        </ScrollView>
      </View>

      {/* Password Change Modal */}
      <Modal
        visible={isPasswordModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsPasswordModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Changer le mot de passe</Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Nouveau mot de passe</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="Au moins 6 caractères"
                  placeholderTextColor={colors.textTertiary}
                  secureTextEntry
                  value={newPassword}
                  onChangeText={setNewPassword}
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Confirmer le mot de passe</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[
                    styles.input,
                    newPassword.length > 0 && confirmPassword.length > 0 && {
                      borderColor: newPassword === confirmPassword ? '#10B981' : '#EF4444'
                    }
                  ]}
                  placeholder="Répétez le mot de passe"
                  placeholderTextColor={colors.textTertiary}
                  secureTextEntry
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
                {newPassword.length > 0 && confirmPassword.length > 0 && (
                  <View style={styles.inputIcon}>
                    {newPassword === confirmPassword ? (
                      <CheckCircle2 size={18} color="#10B981" />
                    ) : (
                      <XCircle size={18} color="#EF4444" />
                    )}
                  </View>
                )}
              </View>
              {newPassword.length > 0 && confirmPassword.length > 0 && newPassword !== confirmPassword && (
                <Text style={styles.errorText}>Les mots de passe ne correspondent pas</Text>
              )}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setIsPasswordModalVisible(false);
                  setNewPassword('');
                  setConfirmPassword('');
                }}
              >
                <Text style={styles.modalButtonTextCancel}>Annuler</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalButton, 
                  styles.modalButtonSave,
                  (isUpdating || !newPassword || newPassword !== confirmPassword || newPassword.length < 6) && styles.modalButtonDisabled
                ]}
                onPress={handleSavePassword}
                disabled={isUpdating || !newPassword || newPassword !== confirmPassword || newPassword.length < 6}
              >
                {isUpdating ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={[
                    styles.modalButtonTextSave,
                    (isUpdating || !newPassword || newPassword !== confirmPassword || newPassword.length < 6) && { opacity: 0.5 }
                  ]}>
                    Enregistrer
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    color: colors.text,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 28,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    color: colors.textTertiary,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 12,
    marginLeft: 4,
  },
  sectionFooter: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 8,
    marginLeft: 4,
    lineHeight: 18,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.surfaceHighlight,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceHighlight,
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingItemTitle: {
    fontSize: 16,
    color: colors.text,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(255, 75, 75, 0.1)',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 75, 75, 0.2)',
  },
  logoutText: {
    color: '#FF4B4B',
    fontSize: 16,
    fontWeight: '600',
  },
  versionText: {
    textAlign: 'center',
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.surfaceHighlight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    backgroundColor: colors.surfaceHighlight,
    borderRadius: 12,
    padding: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 16,
    width: '100%',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  inputIcon: {
    position: 'absolute',
    right: 14,
    zIndex: 1,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalButtonSave: {
    backgroundColor: colors.primary,
  },
  modalButtonDisabled: {
    backgroundColor: colors.border,
    opacity: 0.6,
  },
  modalButtonTextCancel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextSave: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
});
