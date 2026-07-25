import { useAuth } from '@/src/app/providers/AuthContext';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { useUserProfile } from '@/src/entities/user/api/useUserProfile';
import { authService } from '@/src/entities/user/api/AuthService';
import { Avatar } from '@/src/shared/ui/Avatar';
import { supabase } from '@/src/shared/api/supabase';
import { UGCModerationService } from '@/src/shared/api/UGCModerationService';
import { getBookTitle, decodeBase64, isUserQuote } from '@/src/shared/lib/dataHelpers';
import { useQuote } from '@/src/entities/quote/providers/QuoteProvider';
import { ThemeColors } from '@/src/shared/theme';
import { CounterTab, AppText, AppText as Text, Input, UserProfileSkeleton, QuoteSkeleton, Button, TabBar } from '@/src/shared/ui';
import { BlockWrapper } from '@/src/shared/ui/blocks/BlockWrapper';
import { DetailHeaderBar } from '@/src/shared/ui/details';
import { LibraryBlock } from '@/src/shared/ui/blocks/LibraryBlock';
import { SavedQuotesBlock } from '@/src/shared/ui/blocks/SavedQuotesBlock';
import { UserListModal } from '@/src/shared/ui/modals/UserListModal';
import { useQueryClient } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router'; import { useRouter } from '@/src/shared/navigation/useRouter';
import { Camera, MoreHorizontal, Quote, X } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';




export default function UserProfileScreen() {
  const router = useRouter();
  const { username } = useLocalSearchParams<{ username?: string }>();
  const { colors } = useTheme();
  const { user: currentUser, updateProfile } = useAuth();
  const { quotes: allQuotes } = useQuote();
  const queryClient = useQueryClient();

  const { data: profileData, isLoading: isProfileLoading, isFetching } = useUserProfile(username);

  const styles = useMemo(() => createStyles(colors), [colors]);
  const isMe = currentUser?.id === profileData?.id || 
               (currentUser?.username && profileData?.username && 
                currentUser.username.replace('@', '') === profileData.username.replace('@', ''));

  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedBio, setEditedBio] = useState('');
  const [editedWebsite, setEditedWebsite] = useState('');
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Quotes modal states
  const [showAllQuotesModal, setShowAllQuotesModal] = useState(false);
  const [hasRenderedQuotesModal, setHasRenderedQuotesModal] = useState(false);
  const [modalQuoteFilter, setModalQuoteFilter] = useState<'ALL' | 'PUBLISHED' | 'SAVED'>('ALL');

  const userQuotes = useMemo(() => {
    if (isMe) {
      return allQuotes
        .filter(q => isUserQuote(q, currentUser?.id))
        .sort((a, b) => {
          const dateA = new Date(a.savedAt || a.date || 0).getTime();
          const dateB = new Date(b.savedAt || b.date || 0).getTime();
          return dateB - dateA;
        });
    }

    if (!profileData || !(profileData as any).quotes) return [];
    return (profileData as any).quotes.map((q: any) => ({
      ...q,
      user: profileData,
      time: q.date ? new Date(q.date).toLocaleDateString() : 'Récemment'
    }));
  }, [profileData, isMe, allQuotes, currentUser]);

  const filteredModalQuotes = useMemo(() => {
    if (!profileData) return [];
    const targetOwnerId = profileData.id;
    if (modalQuoteFilter === 'PUBLISHED') {
      return userQuotes.filter((q: any) => q.user?.id === targetOwnerId || !q.user);
    } else if (modalQuoteFilter === 'SAVED') {
      return userQuotes.filter((q: any) => q.user && q.user?.id !== targetOwnerId && q.isSaved);
    }
    return userQuotes;
  }, [userQuotes, modalQuoteFilter, profileData]);

  const userBooks = useMemo(() => {
    if (!profileData || !(profileData as any).library) return [];
    return (profileData as any).library;
  }, [profileData]);

  const [isFollowing, setIsFollowing] = useState(false);
  const [prevProfileData, setPrevProfileData] = useState<any>(null);
  if (profileData !== prevProfileData) {
    setPrevProfileData(profileData);
    setIsFollowing(!!(profileData as any)?.isFollowing);
  }

  // Follow modal states
  const [isFollowModalVisible, setIsFollowModalVisible] = useState(false);
  const [followModalTab, setFollowModalTab] = useState<'followers' | 'following'>('followers');
  const [followList, setFollowList] = useState<any[]>([]);
  const [isFollowListLoading, setIsFollowListLoading] = useState(false);



  const fetchFollowList = async (tab: 'followers' | 'following') => {
    if (!profileData?.id) return;
    setIsFollowListLoading(true);
    setFollowList([]);
    try {
      let data: any[] = [];
      if (tab === 'followers') {
        data = await authService.getFollowers(profileData.id);
      } else {
        data = await authService.getFollowing(profileData.id);
      }
      setFollowList(data);
    } catch (error) {
      console.error('Error fetching follow list:', error);
      Alert.alert('Erreur', 'Impossible de récupérer la liste des utilisateurs.');
    } finally {
      setIsFollowListLoading(false);
    }
  };

  const openFollowModal = (tab: 'followers' | 'following') => {
    setFollowModalTab(tab);
    setIsFollowModalVisible(true);
    fetchFollowList(tab);
  };


  const toggleFollow = async () => {
    if (!profileData || !currentUser) return;

    const newFollowState = !isFollowing;
    setIsFollowing(newFollowState);

    // Optimistic cache update for followers count
    const profileQueryKey = username || `me_${currentUser?.id || 'none'}`;
    const currentFollowers = profileData.followers || 0;
    
    const updatedProfile = {
      ...profileData,
      followers: newFollowState ? currentFollowers + 1 : Math.max(currentFollowers - 1, 0),
      isFollowing: newFollowState
    };
    queryClient.setQueryData(['userProfile', profileQueryKey], updatedProfile);

    try {
      if (newFollowState) {
        await authService.followUser(profileData.id);
      } else {
        await authService.unfollowUser(profileData.id);
      }
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
    } catch (error) {
      console.error('Error toggling follow:', error);
      // Revert in case of failure
      setIsFollowing(!newFollowState);
      queryClient.setQueryData(['userProfile', profileQueryKey], profileData);
      Alert.alert('Erreur', "Impossible de mettre à jour l'abonnement.");
    }
  };

  const handleEditToggle = () => {
    setEditedName(profileData?.name || '');
    setEditedBio(profileData?.bio || '');
    setEditedWebsite(profileData?.website || '');
    setEditedImage(profileData?.image || null);
    setIsEditing(true);
  };

  const handleProfileOptions = () => {
    Alert.alert(
      "Options",
      "Que souhaitez-vous faire avec ce profil ?",
      [
        { 
          text: "Bloquer cet utilisateur", 
          style: "destructive",
          onPress: async () => {
            if (profileData?.id) {
              await UGCModerationService.blockUser(profileData.id);
              Alert.alert("Succès", "L'utilisateur a été bloqué.");
              router.back();
            }
          }
        },
        { text: "Annuler", style: "cancel" }
      ]
    );
  };

  const pickImage = async () => {
    // Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Désolé, nous avons besoin de la permission d\'accéder à votre galerie pour changer votre photo !');
      return;
    }

    setTimeout(async () => {
      try {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.7,
        });

        if (!result.canceled) {
          const originalUri = result.assets[0].uri;
          
          // Compress and resize the image
          const manipResult = await ImageManipulator.manipulateAsync(
            originalUri,
            [{ resize: { width: 400, height: 400 } }],
            { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
          );

          // On utilise le base64 pour l'upload mais l'URI pour l'aperçu local
          const imageUri = manipResult.uri;
          setEditedImage(imageUri);
          
          // Stockage temporaire du base64 pour handleSave
          (global as any).lastPickedBase64 = manipResult.base64;

          // Nettoyage des fichiers temporaires (uniquement l'original)
          try {
            await FileSystem.deleteAsync(originalUri, { idempotent: true });
          } catch (e) {
            console.log("Erreur lors de la suppression du fichier temporaire:", e);
          }
        }
      } catch (err) {
        console.error('[UserProfile] Picker launch error:', err);
      }
    }, 100);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedImage(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (!profileData || !currentUser) throw new Error("Données de profil non disponibles");
      let imageUrl = profileData.image;

      // Si une nouvelle image a été sélectionnée (commence par 'file://' sur mobile)
      if (editedImage && (editedImage.startsWith('file://') || editedImage.startsWith('content://'))) {
        try {
          console.log("[Storage] Début de l'upload via ArrayBuffer pour l'utilisateur:", currentUser?.id);
          
          const base64 = (global as any).lastPickedBase64;
          if (!base64) throw new Error("Données d'image manquantes");

          const arrayBuffer = decodeBase64(base64);
          console.log("[Storage] ArrayBuffer généré, taille:", arrayBuffer.byteLength);

          const fileExt = 'jpg';
          const fileName = `avatar_${Date.now()}.${fileExt}`;
          const filePath = `${currentUser?.id}/${fileName}`;
          console.log("[Storage] Chemin cible:", filePath);

          // Upload vers Supabase Storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, arrayBuffer, {
              cacheControl: '3600',
              upsert: true,
              contentType: 'image/jpeg'
            });

          if (uploadError) {
            console.error("[Storage] Erreur lors de l'upload:", uploadError);
            throw uploadError;
          }

          console.log("[Storage] Upload réussi:", uploadData.path);
          delete (global as any).lastPickedBase64; // Nettoyage

          // Récupération de l'URL publique
          const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);
          
          console.log("[Storage] URL publique générée:", publicUrl);
          imageUrl = publicUrl;
        } catch (uploadErr) {
          console.error("[Storage] Erreur fatale upload:", uploadErr);
          throw new Error("Impossible d'uploader la photo de profil");
        }
      }

      await updateProfile({
        name: editedName,
        bio: editedBio,
        website: editedWebsite,
        image: imageUrl || undefined
      });

      // --- Nettoyage de l'ancien avatar sur Supabase Storage ---
      const oldImageUrl = profileData.image;
      if (oldImageUrl && imageUrl && oldImageUrl !== imageUrl && oldImageUrl.includes('/public/avatars/')) {
        try {
          // Extraire le chemin relatif du fichier (tout ce qui est après /avatars/)
          const pathParts = oldImageUrl.split('/avatars/');
          if (pathParts.length > 1) {
            const oldPath = pathParts[1];
            console.log("[Storage] Nettoyage de l'ancien fichier:", oldPath);
            await supabase.storage.from('avatars').remove([oldPath]);
          }
        } catch (cleanupErr) {
          console.error("[Storage] Erreur lors du nettoyage de l'ancien fichier:", cleanupErr);
          // On n'interrompt pas le succès global si le nettoyage échoue
        }
      }
      // ---------------------------------------------------------

      // Update react query cache directly for immediate UI feedback
      if (profileData) {
        const updatedProfile = {
          ...profileData,
          name: editedName,
          bio: editedBio,
          website: editedWebsite,
          image: imageUrl || profileData.image
        };
        
        const isViewingOwnProfile = !username || (currentUser?.username && currentUser.username.replace('@', '') === username.replace('@', ''));
        const profileQueryKey = isViewingOwnProfile ? `me_${currentUser?.id || 'none'}` : username;
        
        queryClient.setQueryData(['userProfile', profileQueryKey], updatedProfile);
        queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      }

      console.log("Profile updated successfully");
      setIsEditing(false);
      setEditedImage(null); // Reset preview URI
      
      // Nettoyage du fichier manipulé après upload réussi
      if (editedImage) {
        await FileSystem.deleteAsync(editedImage, { idempotent: true }).catch(() => {});
      }
    } catch (e) {
      console.error("Error saving profile", e);
      alert(e instanceof Error ? e.message : "Erreur lors de la sauvegarde du profil");
    } finally {
      setIsSaving(false);
    }
  };

  if (!profileData && isProfileLoading) {
    return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <DetailHeaderBar
          title={username ? `@${username}` : 'Profil'}
          onBack={() => router.back()}
        />
        <UserProfileSkeleton />
      </SafeAreaView>
    );
  }

  if (!profileData) {
    return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <DetailHeaderBar
          title="Profil introuvable"
          onBack={() => router.back()}
        />
        <View style={styles.loaderContainer}>
          <Text style={{ color: colors.text }}>Utilisateur non trouvé</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        {/* Header */}
        <DetailHeaderBar
          title={`@${profileData?.username || username}`}
          onBack={() => router.back()}
          actions={!isMe && profileData ? [{
            key: 'options',
            icon: <MoreHorizontal size={24} color={colors.text} />,
            onPress: handleProfileOptions,
          }] : []}
        />

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Profile Section */}
          <View style={styles.profileHeader}>
            <TouchableOpacity
              style={styles.avatar}
              onPress={isEditing ? pickImage : undefined}
              disabled={!isEditing}
              accessible={true}
              accessibilityLabel="Photo de profil"
              accessibilityRole="button"
              testID="avatar-button"
            >
              <Avatar
                user={{ ...profileData, image: editedImage || profileData.image || undefined }}
                size={80}
                style={styles.avatarImage}
                textStyle={styles.avatarText}
              />

              {isEditing && (
                <View style={styles.avatarOverlay}>
                  <Camera size={24} color="#FFF" />
                </View>
              )}
            </TouchableOpacity>
            {isEditing ? (
              <TextInput
                style={[styles.userName, styles.userNameInput]}
                value={editedName}
                onChangeText={setEditedName}
                placeholder="Prénom"
                placeholderTextColor={colors.textTertiary}
                accessible={true}
                accessibilityLabel="Prénom"
                testID="user-name-input"
              />
            ) : (
              <Text style={styles.userName}>{profileData.name}</Text>
            )}
            <Text style={styles.userUsername}>@{profileData.username}</Text>

            {isMe ? (
              isEditing ? (
                <View style={styles.editActionsContainer}>
                  <Button
                    title="Enregistrer"
                    variant="primary"
                    onPress={handleSave}
                    isLoading={isSaving}
                    disabled={isSaving}
                    accessibilityLabel="Enregistrer les modifications du profil"
                    testID="save-profile-button"
                  />
                  <Button
                    title="Annuler"
                    variant="outline"
                    onPress={handleCancel}
                    disabled={isSaving}
                    accessibilityLabel="Annuler les modifications du profil"
                    testID="cancel-profile-button"
                  />
                </View>
              ) : (
                <Button
                  title="Modifier le profil"
                  variant="outline"
                  onPress={handleEditToggle}
                  accessibilityLabel="Modifier le profil"
                  testID="edit-profile-button"
                />
              )
            ) : (
              <Button
                title={isFollowing ? 'Abonné' : "S'abonner"}
                variant={isFollowing ? 'secondary' : 'primary'}
                onPress={toggleFollow}
                accessibilityLabel={isFollowing ? "Se désabonner de l'utilisateur" : "S'abonner à l'utilisateur"}
                testID="follow-button"
              />
            )}
          </View>

          {/* Stats */}
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
            <CounterTab
              value={profileData.followers || 0}
              label="Abonnés"
              onPress={() => openFollowModal('followers')}
              accessibilityLabel="Voir la liste des abonnés"
              accessibilityRole="button"
            />
            <CounterTab
              value={profileData.following || 0}
              label="Abonnements"
              onPress={() => openFollowModal('following')}
              accessibilityLabel="Voir la liste des abonnements"
              accessibilityRole="button"
            />
            <CounterTab
              value={userQuotes.length}
              label="Citations"
              onPress={() => {
                if (userQuotes.length > 0) {
                  setHasRenderedQuotesModal(true);
                  setShowAllQuotesModal(true);
                }
              }}
              accessibilityLabel="Voir la liste des citations"
              accessibilityRole="button"
            />
          </View>

          {/* Bio */}
          <BlockWrapper blockKey="bio">
            {isEditing ? (
              <Input
                label="Bio"
                value={editedBio}
                onChangeText={setEditedBio}
                placeholder="Décrivez-vous..."
                multiline
                inputContainerStyle={{ minHeight: 80, paddingVertical: 10 }}
                containerStyle={{ marginBottom: 0 }}
                accessible={true}
                accessibilityLabel="Description"
                testID="bio-input"
              />
            ) : (
              <AppText color={profileData.bio ? 'default' : 'tertiary'} align="center">
                {profileData.bio || "Aucune description"}
              </AppText>
            )}
          </BlockWrapper>

          {/* Library Section */}
          <LibraryBlock
            books={userBooks}
            isLoading={isProfileLoading || isFetching}
          />

          {/* User's Quotes */}
          {(isProfileLoading || isFetching) ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Quote size={16} color={colors.primary} />
                <Text style={styles.sectionTitle}>Citations partagées</Text>
              </View>
              <View style={{ gap: 12 }}>
                <QuoteSkeleton colors={colors} />
                <QuoteSkeleton colors={colors} />
              </View>
            </View>
          ) : (
            <SavedQuotesBlock
              quotes={userQuotes}
              ownerId={profileData.id}
              title="Citations partagées"
              showBookTitle={true}
              fallbackText="Aucunes citations partagées/enregistrées"
              publishedFallbackText="Aucunes citations partagées"
              savedFallbackText="Aucunes citations enregistrées"
              onQuotePress={(quote) => router.navigate({ pathname: '/quote-detail', params: { quoteId: quote.id } })}
            />
          )}
        </ScrollView>
      </View>

      {/* Modal Abonnés / Abonnements */}
      <UserListModal<'followers' | 'following'>
        visible={isFollowModalVisible}
        onClose={() => setIsFollowModalVisible(false)}
        tabs={[
          { key: 'followers', label: 'Abonnés' },
          { key: 'following', label: 'Abonnements' },
        ]}
        activeTab={followModalTab}
        onTabChange={(tabKey) => {
          setFollowModalTab(tabKey);
          fetchFollowList(tabKey);
        }}
        users={followList}
        isLoading={isFollowListLoading}
        emptyText={
          followModalTab === 'followers'
            ? 'Aucun abonné pour le moment.'
            : 'Aucun abonnement pour le moment.'
        }
      />

      {/* Modal de toutes les citations */}
      {hasRenderedQuotesModal && (
        <Modal
          visible={showAllQuotesModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowAllQuotesModal(false)}
        >
          <View style={styles.quotesModalContainer}>
            <View style={styles.quotesModalHeader}>
              <TabBar
                tabs={[
                  { id: 'ALL', label: 'Tout' },
                  { id: 'PUBLISHED', label: 'Publiées' },
                  { id: 'SAVED', label: 'Partagées' }
                ]}
                activeTab={modalQuoteFilter}
                onTabPress={(tabId) => setModalQuoteFilter(tabId as any)}
                style={{ flex: 1, paddingHorizontal: 0, paddingBottom: 0, borderBottomWidth: 0, backgroundColor: 'transparent' }}
              />
              <TouchableOpacity 
                style={styles.modalCloseButton} 
                onPress={() => setShowAllQuotesModal(false)}
                accessible={true}
                accessibilityLabel="Fermer"
                accessibilityRole="button"
              >
                <X size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <FlashList
              data={filteredModalQuotes as any[]}
              keyExtractor={(item: any) => String(item.id)}
              getItemType={() => 'quote'}
              removeClippedSubviews={true}
              contentContainerStyle={styles.quotesModalListContent}
              renderItem={({ item }) => {
                const isQuoteMine = item.user?.id === currentUser?.id || !item.user;
                return (
                  <TouchableOpacity
                    style={styles.quoteModalCard}
                    activeOpacity={0.8}
                    onPress={() => {
                      setShowAllQuotesModal(false);
                      router.navigate({
                        pathname: '/quote-detail',
                        params: { quoteId: item.id }
                      });
                    }}
                  >
                    <Text style={styles.quoteModalText}>“ {item.text} ”</Text>
                    <View style={styles.quoteModalMeta}>
                      <Text style={styles.quoteModalBook}>{getBookTitle(item.book)}</Text>
                      <Text style={styles.quoteModalUser}>
                        Par {isQuoteMine ? 'Moi' : item.user?.name || `@${item.user?.username}`}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.centered}>
                  <Text style={styles.placeholderText}>Aucune citation trouvée.</Text>
                </View>
              }
            />
          </View>
        </Modal>
      )}
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
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 2,
    borderColor: colors.primary,
    marginBottom: 12,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    color: colors.primary,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 20,
    color: colors.text,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userUsername: {
    fontSize: 14,
    color: colors.textTertiary,
    marginBottom: 16,
  },
  followButton: {
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  followButtonActive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  followButtonText: {
    color: '#000', // Assuming text on primary is black
    fontSize: 14,
    fontWeight: 'bold',
  },
  followButtonTextActive: {
    color: colors.primary,
  },
  editButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  editButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceHighlight,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },

  linksContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  linkText: {
    fontSize: 12,
    color: colors.primary,
  },
  sectionTitle: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  placeholderText: {
    fontSize: 14,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingVertical: 24,
  },
  userNameInput: {
    borderBottomWidth: 1,
    borderBottomColor: colors.primary,
    paddingVertical: 4,
    minWidth: 150,
    textAlign: 'center',
    marginBottom: 8,
  },
  editActionsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    minWidth: 120,
  },
  saveButtonText: {
    color: '#000',
    fontWeight: 'bold',
  },
  cancelButton: {
    borderColor: colors.border,
  },
  cancelButtonText: {
    color: colors.textSecondary,
  },


  websiteInput: {
    backgroundColor: colors.surfaceHighlight,
    borderRadius: 8,
    padding: 12,
    color: colors.text,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    minHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTabs: {
    flexDirection: 'row',
    gap: 16,
  },
  modalTabButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  modalTabButtonActive: {
    borderBottomColor: colors.primary,
  },
  modalTabText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  modalTabTextActive: {
    color: colors.primary,
  },
  modalCloseButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: colors.surfaceHighlight,
  },
  modalBody: {
    flex: 1,
  },
  modalLoaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalListContent: {
    padding: 16,
    paddingBottom: 32,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceHighlight,
  },
  userRowAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  userRowAvatarImage: {
    width: '100%',
    height: '100%',
  },
  userRowAvatarPlaceholder: {
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userRowAvatarText: {
    color: colors.primary,
    fontWeight: 'bold',
    fontSize: 18,
  },
  userRowInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  userRowName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  userRowUsername: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 2,
  },
  userRowBio: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  modalEmptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalEmptyText: {
    color: colors.textTertiary,
    fontSize: 14,
    textAlign: 'center',
  },
  quotesModalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  quotesModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginTop: Platform.OS === 'ios' ? 0 : 20,
  },
  quotesModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  quotesModalListContent: {
    padding: 16,
    paddingBottom: 32,
  },
  quoteModalCard: {
    backgroundColor: colors.surfaceHighlight,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  quoteModalText: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
    fontStyle: 'italic',
    marginBottom: 12,
    fontFamily: 'serif',
  },
  quoteModalMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  quoteModalBook: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  quoteModalUser: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});