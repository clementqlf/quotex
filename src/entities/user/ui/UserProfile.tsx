import { useAuth } from '@/src/app/providers/AuthContext';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { useUserProfile } from '@/src/entities/user/api/useUserProfile';
import { authService } from '@/src/entities/user/api/AuthService';
import { UserAvatar } from '@/src/entities/user/ui/UserAvatar';
import { supabase } from '@/src/shared/api/supabase';
import { UGCModerationService } from '@/src/shared/api/UGCModerationService';
import { getAuthorName, getBookTitle, decodeBase64, isUserQuote } from '@/src/shared/lib/dataHelpers';
import { useQuote } from '@/src/entities/quote/providers/QuoteProvider';
import { ThemeColors } from '@/src/shared/theme';
import { SavedQuotesBlock } from '@/src/shared/ui/blocks/SavedQuotesBlock';
import { useQueryClient } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BookOpen, Camera, ChevronLeft, Library, MoreHorizontal, Quote, X } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import AnimatedReanimated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';



const BookSkeleton = ({ colors }: { colors: ThemeColors }) => {
  const [pulseAnim] = useState(() => new Animated.Value(0.3));

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.8,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  return (
    <Animated.View
      style={{
        width: 90,
        height: 135,
        borderRadius: 8,
        backgroundColor: colors.surfaceHighlight,
        opacity: pulseAnim,
      }}
    />
  );
};

const QuoteSkeleton = ({ colors }: { colors: ThemeColors }) => {
  const [pulseAnim] = useState(() => new Animated.Value(0.3));

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.8,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  return (
    <Animated.View
      style={{
        width: '100%',
        height: 100,
        borderRadius: 12,
        backgroundColor: colors.surfaceHighlight,
        opacity: pulseAnim,
      }}
    />
  );
};

export const UserProfileSkeleton = ({ colors }: { colors: ThemeColors }) => {
  const opacity = useSharedValue(0.3);

  React.useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 1000 }),
        withTiming(0.3, { duration: 1000 })
      ),
      -1,
      true
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View style={{ flex: 1, padding: 16 }}>
       <View style={{ alignItems: 'center', marginBottom: 24, marginTop: 16 }}>
          <AnimatedReanimated.View style={[{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.surfaceHighlight, marginBottom: 12 }, animatedStyle]} />
          <AnimatedReanimated.View style={[{ width: '50%', height: 26, borderRadius: 4, backgroundColor: colors.surfaceHighlight, marginBottom: 4 }, animatedStyle]} />
          <AnimatedReanimated.View style={[{ width: '30%', height: 16, borderRadius: 4, backgroundColor: colors.surfaceHighlight, marginBottom: 16 }, animatedStyle]} />
          <AnimatedReanimated.View style={[{ width: '40%', height: 36, borderRadius: 8, backgroundColor: colors.surfaceHighlight, marginBottom: 24 }, animatedStyle]} />
       </View>
       
       <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
          <AnimatedReanimated.View style={[{ flex: 1, height: 60, borderRadius: 12, backgroundColor: colors.surfaceHighlight }, animatedStyle]} />
          <AnimatedReanimated.View style={[{ flex: 1, height: 60, borderRadius: 12, backgroundColor: colors.surfaceHighlight }, animatedStyle]} />
          <AnimatedReanimated.View style={[{ flex: 1, height: 60, borderRadius: 12, backgroundColor: colors.surfaceHighlight }, animatedStyle]} />
       </View>
       
       <AnimatedReanimated.View style={[{ width: '100%', height: 80, borderRadius: 16, backgroundColor: colors.surfaceHighlight, marginBottom: 24 }, animatedStyle]} />
       <AnimatedReanimated.View style={[{ width: '100%', height: 120, borderRadius: 16, backgroundColor: colors.surfaceHighlight, marginBottom: 24 }, animatedStyle]} />
    </View>
  );
};



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


  const groupedBooks = useMemo(() => {
    const groups: Record<string, any[]> = {
      'READING': [],
      'FINISHED': [],
      'TO_READ': [],
      'DROPPED': []
    };
    userBooks.forEach((ub: any) => {
      const status = ub.status || 'TO_READ';
      if (groups[status]) {
        groups[status].push(ub.book);
      } else {
        if (!groups['TO_READ']) groups['TO_READ'] = [];
        groups['TO_READ'].push(ub.book);
      }
    });
    return groups;
  }, [userBooks]);

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
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            accessible={true}
            accessibilityLabel="Retour"
            accessibilityRole="button"
            testID="back-button"
          >
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{username ? `@${username}` : 'Profil'}</Text>
          <View style={styles.placeholder} />
        </View>
        <UserProfileSkeleton colors={colors} />
      </SafeAreaView>
    );
  }

  if (!profileData) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            accessible={true}
            accessibilityLabel="Retour"
            accessibilityRole="button"
            testID="back-button"
          >
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profil introuvable</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loaderContainer}>
          <Text style={{ color: colors.text }}>Utilisateur non trouvé</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            accessible={true}
            accessibilityLabel="Retour"
            accessibilityRole="button"
            testID="back-button"
          >
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>@{profileData?.username || username}</Text>
          {!isMe && profileData ? (
            <TouchableOpacity
              onPress={handleProfileOptions}
              style={styles.headerAction}
              accessible={true}
              accessibilityLabel="Options du profil"
              accessibilityRole="button"
              testID="profile-options-button"
            >
              <MoreHorizontal size={24} color={colors.text} />
            </TouchableOpacity>
          ) : (
            <View style={styles.placeholder} />
          )}
        </View>

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
              <UserAvatar
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
                  <TouchableOpacity
                    style={[styles.editButton, styles.saveButton]}
                    onPress={handleSave}
                    disabled={isSaving}
                    accessible={true}
                    accessibilityLabel="Enregistrer les modifications du profil"
                    accessibilityRole="button"
                    testID="save-profile-button"
                  >
                    {isSaving ? (
                      <ActivityIndicator size="small" color="#000" />
                    ) : (
                      <Text style={styles.saveButtonText}>Enregistrer</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.editButton, styles.cancelButton]}
                    onPress={handleCancel}
                    disabled={isSaving}
                    accessible={true}
                    accessibilityLabel="Annuler les modifications du profil"
                    accessibilityRole="button"
                    testID="cancel-profile-button"
                  >
                    <Text style={styles.cancelButtonText}>Annuler</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={handleEditToggle}
                  accessible={true}
                  accessibilityLabel="Modifier le profil"
                  accessibilityRole="button"
                  testID="edit-profile-button"
                >
                  <Text style={styles.editButtonText}>Modifier le profil</Text>
                </TouchableOpacity>
              )
            ) : (
              <TouchableOpacity
                style={[
                  styles.followButton,
                  isFollowing && styles.followButtonActive
                ]}
                onPress={toggleFollow}
                accessible={true}
                accessibilityLabel={isFollowing ? "Se désabonner de l'utilisateur" : "S'abonner à l'utilisateur"}
                accessibilityRole="button"
                testID="follow-button"
              >
                <Text style={[
                  styles.followButtonText,
                  isFollowing && styles.followButtonTextActive
                ]}>
                  {isFollowing ? 'Abonné' : "S'abonner"}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Stats */}
          <View style={styles.statsContainer}>
            <TouchableOpacity 
              style={styles.statItem}
              onPress={() => openFollowModal('followers')}
              accessible={true}
              accessibilityLabel="Voir la liste des abonnés"
              accessibilityRole="button"
            >
              <Text style={styles.statValue}>{profileData.followers || 0}</Text>
              <Text style={styles.statLabel}>Abonnés</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.statItem}
              onPress={() => openFollowModal('following')}
              accessible={true}
              accessibilityLabel="Voir la liste des abonnements"
              accessibilityRole="button"
            >
              <Text style={styles.statValue}>{profileData.following || 0}</Text>
              <Text style={styles.statLabel}>Abonnements</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.statItem}
              onPress={() => {
                if (userQuotes.length > 0) {
                  setHasRenderedQuotesModal(true);
                  setShowAllQuotesModal(true);
                }
              }}
              accessible={true}
              accessibilityLabel="Voir la liste des citations"
              accessibilityRole="button"
              activeOpacity={0.7}
            >
              <Text style={styles.statValue}>{userQuotes.length}</Text>
              <Text style={styles.statLabel}>Citations</Text>
            </TouchableOpacity>
          </View>

          {/* Bio */}
          <View style={styles.section}>
            {isEditing ? (
              <View style={styles.editInputsContainer}>
                <Text style={styles.inputLabel}>Bio</Text>
                <TextInput
                  style={styles.bioInput}
                  value={editedBio}
                  onChangeText={setEditedBio}
                  placeholder="Décrivez-vous..."
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  accessible={true}
                  accessibilityLabel="Description"
                  testID="bio-input"
                />
              </View>
            ) : (
              <Text style={styles.bioText}>{profileData.bio || "Aucune description"}</Text>
            )}
          </View>

          {/* Library Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Library size={16} color={colors.primary} />
              <Text style={styles.sectionTitle}>Bibliothèque</Text>
            </View>

            {userBooks.length > 0 ? (
              <View style={styles.libraryContainer}>
                {['READING', 'FINISHED', 'TO_READ', 'DROPPED'].map((status) => {
                  const books = groupedBooks[status];
                  if (!books || books.length === 0) return null;

                  const statusLabels: Record<string, string> = {
                    'READING': 'En cours',
                    'FINISHED': 'Terminé',
                    'TO_READ': 'À lire',
                    'DROPPED': 'Abandonné'
                  };

                  return (
                    <View key={status} style={styles.libraryStatusSection}>
                      <Text style={styles.libraryStatusTitle}>{statusLabels[status]}</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {books.map((book: any) => (
                          <TouchableOpacity
                            key={book.id}
                            style={styles.bookItem}
                            onPress={() => router.push({ pathname: '/book-detail', params: { bookId: book.id.toString(), bookTitle: book.title } })}
                          >
                            {book.cover ? (
                              <Image source={{ uri: book.cover }} style={styles.bookCover} />
                            ) : (
                              <View style={[styles.bookCover, styles.placeholderCover]}>
                                <BookOpen size={20} color={colors.textTertiary} />
                              </View>
                            )}
                            <Text numberOfLines={2} style={styles.bookTitle}>{book.title}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  );
                })}
              </View>
            ) : (isProfileLoading || isFetching) ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                <BookSkeleton colors={colors} />
                <BookSkeleton colors={colors} />
                <BookSkeleton colors={colors} />
              </ScrollView>
            ) : (
              <Text style={styles.placeholderText}>Cet utilisateur n&apos;a pas encore de livres dans sa bibliothèque.</Text>
            )}
          </View>

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
      <Modal
        visible={isFollowModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsFollowModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalContainer}>
            {/* Header / Tabs */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTabs}>
                <TouchableOpacity
                  style={[
                    styles.modalTabButton,
                    followModalTab === 'followers' && styles.modalTabButtonActive,
                  ]}
                  onPress={() => {
                    setFollowModalTab('followers');
                    fetchFollowList('followers');
                  }}
                >
                  <Text
                    style={[
                      styles.modalTabText,
                      followModalTab === 'followers' && styles.modalTabTextActive,
                    ]}
                  >
                    Abonnés
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalTabButton,
                    followModalTab === 'following' && styles.modalTabButtonActive,
                  ]}
                  onPress={() => {
                    setFollowModalTab('following');
                    fetchFollowList('following');
                  }}
                >
                  <Text
                    style={[
                      styles.modalTabText,
                      followModalTab === 'following' && styles.modalTabTextActive,
                    ]}
                  >
                    Abonnements
                  </Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setIsFollowModalVisible(false)}
                accessible={true}
                accessibilityLabel="Fermer"
                accessibilityRole="button"
              >
                <X size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* List / Content */}
            <View style={styles.modalBody}>
              {isFollowListLoading ? (
                <View style={styles.modalLoaderContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              ) : followList.length > 0 ? (
                <ScrollView
                  contentContainerStyle={styles.modalListContent}
                  showsVerticalScrollIndicator={false}
                >
                  {followList.map((user: any) => (
                    <TouchableOpacity
                      key={user.id}
                      style={styles.userRow}
                      onPress={() => {
                        setIsFollowModalVisible(false);
                        // Redirect to profile
                        router.push({
                          pathname: '/user-profile',
                          params: { username: user.username },
                        });
                      }}
                    >
                      <UserAvatar
                        user={user}
                        size={48}
                        style={styles.userRowAvatar}
                        textStyle={styles.userRowAvatarText}
                      />
                      <View style={styles.userRowInfo}>
                        <Text style={styles.userRowName}>{user.name}</Text>
                        <Text style={styles.userRowUsername}>@{user.username}</Text>
                        {user.bio ? (
                          <Text style={styles.userRowBio} numberOfLines={1}>
                            {user.bio}
                          </Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.modalEmptyContainer}>
                  <Text style={styles.modalEmptyText}>
                    {followModalTab === 'followers'
                      ? "Aucun abonné pour le moment."
                      : "Aucun abonnement pour le moment."}
                  </Text>
                </View>
              )}
            </View>
          </SafeAreaView>
        </View>
      </Modal>

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
              <View style={styles.modalTabs}>
                <TouchableOpacity
                  style={[
                    styles.modalTabButton,
                    modalQuoteFilter === 'ALL' && styles.modalTabButtonActive,
                  ]}
                  onPress={() => setModalQuoteFilter('ALL')}
                >
                  <Text
                    style={[
                      styles.modalTabText,
                      modalQuoteFilter === 'ALL' && styles.modalTabTextActive,
                    ]}
                  >
                    Tout
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalTabButton,
                    modalQuoteFilter === 'PUBLISHED' && styles.modalTabButtonActive,
                  ]}
                  onPress={() => setModalQuoteFilter('PUBLISHED')}
                >
                  <Text
                    style={[
                      styles.modalTabText,
                      modalQuoteFilter === 'PUBLISHED' && styles.modalTabTextActive,
                    ]}
                  >
                    Publiés
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalTabButton,
                    modalQuoteFilter === 'SAVED' && styles.modalTabButtonActive,
                  ]}
                  onPress={() => setModalQuoteFilter('SAVED')}
                >
                  <Text
                    style={[
                      styles.modalTabText,
                      modalQuoteFilter === 'SAVED' && styles.modalTabTextActive,
                    ]}
                  >
                    Partagées
                  </Text>
                </TouchableOpacity>
              </View>
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
    flex: 1,
    textAlign: 'center',
    fontWeight: '600',
  },
  placeholder: {
    width: 32,
  },
  headerAction: {
    padding: 4,
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
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
  bioText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
    textAlign: 'center',
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
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceHighlight,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    color: colors.primary,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
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

  libraryContainer: {
    gap: 16,
  },
  libraryStatusSection: {
    marginBottom: 4,
  },
  libraryStatusTitle: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bookItem: {
    width: 90,
    marginRight: 12,
  },
  bookCover: {
    width: 90,
    height: 135,
    borderRadius: 8,
    backgroundColor: colors.surfaceHighlight,
    marginBottom: 6,
  },
  placeholderCover: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookTitle: {
    fontSize: 11,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 14,
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
  editInputsContainer: {
    gap: 12,
  },
  inputLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: -4,
  },
  bioInput: {
    backgroundColor: colors.surfaceHighlight,
    borderRadius: 8,
    padding: 12,
    color: colors.text,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
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