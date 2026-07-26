import { useAuth } from '@/src/app/providers/AuthContext';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { logError } from '@/src/shared/infrastructure/monitoring/sentry';
import { DeleteAccountButton } from '@/src/shared/ui/DeleteAccountButton';
import { useAuthor } from '@/src/entities/author/providers/AuthorProvider';
import { useQuote } from '@/src/entities/quote/providers/QuoteProvider';
import { STORAGE_KEYS, StorageService } from '@/src/shared/api/StorageService';
import * as FileSystem from 'expo-file-system/legacy';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from '@/src/shared/navigation/useRouter';
import * as WebBrowser from 'expo-web-browser';
import { useQueryClient } from '@tanstack/react-query';
import { OperationQueue } from '@/src/shared/lib/offline/OperationQueue';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as Linking from 'expo-linking';
import {
  Bell,
  CheckCircle2,
  CircleHelp,
  FileText,
  Lock,
  LogOut,
  Moon,
  Shield,
  Trash2,
  User,
  XCircle
} from 'lucide-react-native';
import React from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AppText,
  Button,
  Card,
  Divider,
  IconButton,
  Input,
  Modal,
  SettingItem,
  Switch,
} from '@/src/shared/ui';
import { DetailHeaderBar } from '@/src/shared/ui/details';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'web') {
    return null;
  }

  if (!Device.isDevice) {
    Alert.alert(
      "Simulateur détecté",
      "Les notifications push ne sont pas prises en charge sur simulateur. Veuillez tester sur un appareil physique."
    );
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      Alert.alert(
        "Permissions refusées",
        "Veuillez activer les permissions de notifications dans les réglages de votre appareil pour recevoir des notifications."
      );
      return null;
    }

    const token = (await Notifications.getExpoPushTokenAsync({
      projectId: 'eaa0560e-b9b6-4344-a4ab-3d9283e277f9',
    })).data;
    console.log('[Notifications] Token retrieved:', token);

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    return token;
  } catch (error) {
    console.warn('[Notifications] Error registering for push notifications:', error);
    return null;
  }
}

export default function SettingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { logout, deleteAccount, user, updateProfile } = useAuth();
  const { colors, themePreference } = useTheme();
  const { refreshQuotes } = useQuote();
  const { refreshAuthors, refreshBooks } = useAuthor();

  const [isUpdating, setIsUpdating] = React.useState(false);
  const [isPasswordModalVisible, setIsPasswordModalVisible] = React.useState(false);
  const [isThemeModalVisible, setIsThemeModalVisible] = React.useState(false);
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');

  const [isNotificationsModalVisible, setIsNotificationsModalVisible] = React.useState(false);
  const [globalNotificationsEnabled, setGlobalNotificationsEnabled] = React.useState(!!user?.expoPushToken);
  const [notifyOnFollow, setNotifyOnFollow] = React.useState(user?.notifyOnFollow ?? true);
  const [notifyOnLike, setNotifyOnLike] = React.useState(user?.notifyOnLike ?? true);
  const [isSavingNotifications, setIsSavingNotifications] = React.useState(false);



  const handleSaveNotifications = async () => {
    if (isSavingNotifications) return;
    setIsSavingNotifications(true);

    try {
      if (globalNotificationsEnabled) {
        let token: string | null | undefined = user?.expoPushToken;
        if (!token) {
          token = await registerForPushNotificationsAsync();
        }

        if (token) {
          await updateProfile({
            expoPushToken: token,
            notifyOnFollow,
            notifyOnLike,
          });
          Alert.alert("Succès", "Vos préférences de notification ont été mises à jour.");
          setIsNotificationsModalVisible(false);
        } else {
          setGlobalNotificationsEnabled(false);
        }
      } else {
        await updateProfile({
          expoPushToken: null,
          notifyOnFollow,
          notifyOnLike,
        });
        Alert.alert("Succès", "Vos notifications push ont été désactivées.");
        setIsNotificationsModalVisible(false);
      }
    } catch (err) {
      console.error('[SettingsScreen] Failed to save notifications:', err);
      Alert.alert("Erreur", "Impossible d'enregistrer vos préférences de notification.");
    } finally {
      setIsSavingNotifications(false);
    }
  };

  const handleOpenLink = async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch (error: any) {
      console.warn("Failed to open with WebBrowser, trying Linking fallback:", error);
      try {
        await Linking.openURL(url);
      } catch (linkingError: any) {
        logError(linkingError, { feature: 'open_link', url });
        Alert.alert("Action impossible", "Impossible d'ouvrir le lien dans le navigateur. Vérifiez votre connexion ou les restrictions de votre appareil.");
      }
    }
  };

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
            } catch (error) {
              Alert.alert("Erreur", (error as Error).message || "Échec de la mise à jour");
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
    } catch (error) {
      Alert.alert("Erreur", (error as Error).message || "Échec de la mise à jour");
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
            } catch (error) {
              console.error("Delete account error", error);
              Alert.alert("Erreur", (error as Error).message || "Impossible de supprimer le compte.");
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
                  await FileSystem.deleteAsync(cacheDir + file, { idempotent: true }).catch(() => { });
                }
              }

              // 3. Clear AsyncStorage cached data keys
              await StorageService.removeItem(STORAGE_KEYS.QUOTES);
              await StorageService.removeItem(STORAGE_KEYS.AUTHORS);
              await StorageService.removeItem(STORAGE_KEYS.BOOKS);
              await StorageService.removeItem(STORAGE_KEYS.BLOCK_LAYOUTS);
              await StorageService.removeItem(STORAGE_KEYS.BLOCK_DATA);
              await StorageService.removeItem(STORAGE_KEYS.USER_DATA);
              await OperationQueue.getInstance().clear();

              // 4. Clear React Query Cache to invalidate in-memory caches and active operations
              queryClient.clear();

              // 5. Force data refresh in the provider to synchronize memory state
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

  const getThemeLabel = () => {
    switch (themePreference) {
      case 'auto': return 'Auto';
      case 'dark': return 'Sombre';
      case 'light': return 'Clair';
      default: return 'Auto';
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
      <View style={{ flex: 1 }}>
        {/* Header */}
        <DetailHeaderBar
          title="Paramètres"
          onBack={() => router.back()}
          style={{
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        />

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {/* Account Section */}
          <View style={{ marginBottom: 24 }}>
            <AppText variant="caption" weight="semibold" color="tertiary" style={{ marginBottom: 12, marginLeft: 4, textTransform: 'uppercase' }}>
              Compte
            </AppText>
            <Card variant="outlined" padding="none" style={{ borderRadius: 16, overflow: 'hidden' }}>
              <SettingItem
                icon={<User size={20} color={colors.primary} />}
                title="Nom d'utilisateur"
                onPress={handleUpdateUsername}
              />
              <Divider />
              <SettingItem
                icon={<Lock size={20} color={colors.primary} />}
                title="Mot de passe"
                onPress={() => setIsPasswordModalVisible(true)}
              />
              <Divider />
              <SettingItem
                icon={<Bell size={20} color={colors.primary} />}
                title="Notifications"
                onPress={() => {
                  setGlobalNotificationsEnabled(!!user?.expoPushToken);
                  setNotifyOnFollow(user?.notifyOnFollow ?? true);
                  setNotifyOnLike(user?.notifyOnLike ?? true);
                  setIsNotificationsModalVisible(true);
                }}
              />
              <Divider />
              <SettingItem
                icon={<Trash2 size={20} color={colors.error} />}
                title="Supprimer mon compte"
                onPress={handleDeleteAccount}
              />
            </Card>
          </View>

          {/* App Section */}
          <View style={{ marginBottom: 24 }}>
            <AppText variant="caption" weight="semibold" color="tertiary" style={{ marginBottom: 12, marginLeft: 4, textTransform: 'uppercase' }}>
              Application
            </AppText>
            <Card variant="outlined" padding="none" style={{ borderRadius: 16, overflow: 'hidden' }}>
              <SettingItem
                icon={<Moon size={20} color={colors.primary} />}
                title="Mode Sombre"
                type="chevron"
                rightText={getThemeLabel()}
                onPress={() => setIsThemeModalVisible(true)}
              />
              <Divider />
              <SettingItem
                icon={<CircleHelp size={20} color={colors.primary} />}
                title="Aide & Support"
                onPress={() => { }}
              />
            </Card>
          </View>

          {/* Storage Section */}
          <View style={{ marginBottom: 24 }}>
            <AppText variant="caption" weight="semibold" color="tertiary" style={{ marginBottom: 12, marginLeft: 4, textTransform: 'uppercase' }}>
              Stockage et Données
            </AppText>
            <Card variant="outlined" padding="none" style={{ borderRadius: 16, overflow: 'hidden' }}>
              <SettingItem
                icon={<Trash2 size={20} color={colors.primary} />}
                title="Vider le cache"
                onPress={handleClearCache}
              />
            </Card>
            <AppText variant="caption" color="tertiary" style={{ marginTop: 8, marginLeft: 4, lineHeight: 18 }}>
              {"Libérez de l'espace en supprimant les images, données locales et fichiers temporaires."}
            </AppText>
          </View>

          {/* Legal Section */}
          <View style={{ marginBottom: 24 }}>
            <AppText variant="caption" weight="semibold" color="tertiary" style={{ marginBottom: 12, marginLeft: 4, textTransform: 'uppercase' }}>
              Légal
            </AppText>
            <Card variant="outlined" padding="none" style={{ borderRadius: 16, overflow: 'hidden' }}>
              <SettingItem
                icon={<FileText size={20} color={colors.primary} />}
                title="Conditions Générales d'Utilisation"
                onPress={() => handleOpenLink('https://clementqlf.github.io/quotex/cgu/')}
              />
              <Divider />
              <SettingItem
                icon={<Shield size={20} color={colors.primary} />}
                title="Politique de Confidentialité"
                onPress={() => handleOpenLink('https://clementqlf.github.io/quotex/confidentialite/')}
              />
            </Card>
          </View>

          {/* Spacer */}
          <View style={{ flex: 1, minHeight: 40 }} />

          {/* Delete Account Button */}
          <DeleteAccountButton
            onPress={async () => {
              await deleteAccount();
              router.replace('/login');
            }}
            isLoading={isUpdating}
          />

          {/* Logout Button */}
          <Button
            title="Déconnexion"
            variant="danger"
            size="md"
            leftIcon={<LogOut size={20} color="#FFFFFF" />}
            onPress={handleLogout}
            accessibilityLabel="Déconnexion"
            testID="logout-button"
            style={{ marginTop: 20 }}
          />

          <AppText variant="caption" color="tertiary" style={{ textAlign: 'center', marginTop: 24 }}>
            Version 1.0.0
          </AppText>
        </ScrollView>
      </View>

      {/* Password Change Modal */}
      <Modal
        visible={isPasswordModalVisible}
        onClose={() => {
          setIsPasswordModalVisible(false);
          setNewPassword('');
          setConfirmPassword('');
        }}
        avoidKeyboard={true}
      >
        <AppText variant="h3" weight="bold" style={{ textAlign: 'center', marginBottom: 20 }}>
          Changer le mot de passe
        </AppText>

        <Input
          label="Nouveau mot de passe"
          placeholder="Au moins 6 caractères"
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
          containerStyle={{ marginBottom: 16 }}
        />

        <Input
          label="Confirmer le mot de passe"
          placeholder="Répétez le mot de passe"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          error={newPassword.length > 0 && confirmPassword.length > 0 && newPassword !== confirmPassword ? 'Les mots de passe ne correspondent pas' : undefined}
          rightIcon={newPassword.length > 0 && confirmPassword.length > 0 ? (
            newPassword === confirmPassword ? (
              <CheckCircle2 size={18} color="#10B981" />
            ) : (
              <XCircle size={18} color="#EF4444" />
            )
          ) : undefined}
          containerStyle={{ marginBottom: 16 }}
        />

        <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
          <Button
            title="Annuler"
            variant="outline"
            onPress={() => {
              setIsPasswordModalVisible(false);
              setNewPassword('');
              setConfirmPassword('');
            }}
            accessibilityLabel="Annuler"
            testID="modal-cancel-button"
            style={{ flex: 1 }}
          />
          <Button
            title="Enregistrer"
            variant="primary"
            onPress={handleSavePassword}
            disabled={isUpdating || !newPassword || newPassword !== confirmPassword || newPassword.length < 6}
            isLoading={isUpdating}
            accessibilityLabel="Enregistrer le mot de passe"
            testID="modal-save-button"
            style={{ flex: 1 }}
          />
        </View>
      </Modal>

      {/* Notifications Preferences Modal */}
      <Modal
        visible={isNotificationsModalVisible}
        onClose={() => setIsNotificationsModalVisible(false)}
      >
        <AppText variant="h3" weight="bold" style={{ textAlign: 'center', marginBottom: 20 }}>
          Préférences de Notifications
        </AppText>

        {/* Global Switch */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 }}>
          <View style={{ flex: 1, paddingRight: 16 }}>
            <AppText variant="body" weight="semibold" style={{ marginBottom: 4 }}>
              Notifications Push
            </AppText>
            <AppText variant="caption" color="tertiary" style={{ lineHeight: 16 }}>
              Activer ou désactiver globalement
            </AppText>
          </View>
          <Switch
            value={globalNotificationsEnabled}
            onValueChange={setGlobalNotificationsEnabled}
          />
        </View>

        <Divider spacing="md" />

        {/* Notify On Follow */}
        <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 }, !globalNotificationsEnabled && { opacity: 0.5 }]}>
          <View style={{ flex: 1, paddingRight: 16 }}>
            <AppText variant="body" weight="semibold" style={{ marginBottom: 4 }}>
              Nouveaux Abonnements
            </AppText>
            <AppText variant="caption" color="tertiary" style={{ lineHeight: 16 }}>
              {"Quand un utilisateur s'abonne à votre profil"}
            </AppText>
          </View>
          <Switch
            value={notifyOnFollow}
            onValueChange={setNotifyOnFollow}
            disabled={!globalNotificationsEnabled}
          />
        </View>

        {/* Notify On Like */}
        <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 }, !globalNotificationsEnabled && { opacity: 0.5 }]}>
          <View style={{ flex: 1, paddingRight: 16 }}>
            <AppText variant="body" weight="semibold" style={{ marginBottom: 4 }}>
              {"Mentions J'aime"}
            </AppText>
            <AppText variant="caption" color="tertiary" style={{ lineHeight: 16 }}>
              {"Quand un utilisateur aime l'une de vos citations"}
            </AppText>
          </View>
          <Switch
            value={notifyOnLike}
            onValueChange={setNotifyOnLike}
            disabled={!globalNotificationsEnabled}
          />
        </View>

        <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
          <Button
            title="Annuler"
            variant="outline"
            onPress={() => setIsNotificationsModalVisible(false)}
            accessibilityLabel="Annuler"
            testID="notif-modal-cancel-button"
            style={{ flex: 1 }}
          />
          <Button
            title="Enregistrer"
            variant="primary"
            onPress={handleSaveNotifications}
            disabled={isSavingNotifications}
            isLoading={isSavingNotifications}
            accessibilityLabel="Enregistrer les préférences"
            testID="notif-modal-save-button"
            style={{ flex: 1 }}
          />
        </View>
      </Modal>

      {/* Theme Selection Modal */}
      <Modal
        visible={isThemeModalVisible}
        onClose={() => setIsThemeModalVisible(false)}
      >
        <AppText variant="h3" weight="bold" style={{ textAlign: 'center', marginBottom: 20 }}>
          {"Mode d'affichage"}
        </AppText>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 8 }}>
          <AppText variant="body" weight={themePreference === 'light' ? 'semibold' : 'regular'} style={{ color: themePreference === 'light' ? colors.primary : colors.text }}>
            Clair
          </AppText>
          {themePreference === 'light' && <CheckCircle2 size={20} color={colors.primary} />}
        </View>

        <Divider spacing="sm" />

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 8 }}>
          <AppText variant="body" weight={themePreference === 'dark' ? 'semibold' : 'regular'} style={{ color: themePreference === 'dark' ? colors.primary : colors.text }}>
            Sombre
          </AppText>
          {themePreference === 'dark' && <CheckCircle2 size={20} color={colors.primary} />}
        </View>

        <Divider spacing="sm" />

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 8 }}>
          <View>
            <AppText variant="body" weight={themePreference === 'auto' ? 'semibold' : 'regular'} style={{ color: themePreference === 'auto' ? colors.primary : colors.text }}>
              Automatique
            </AppText>
            <AppText variant="caption" color="tertiary" style={{ marginTop: 2 }}>
              Utilise les paramètres du système
            </AppText>
          </View>
          {themePreference === 'auto' && <CheckCircle2 size={20} color={colors.primary} />}
        </View>

        <View style={{ height: 20 }} />

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Button
            title="Annuler"
            variant="outline"
            onPress={() => setIsThemeModalVisible(false)}
            style={{ flex: 1 }}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}
