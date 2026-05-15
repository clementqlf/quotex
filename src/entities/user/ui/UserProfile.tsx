import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Mail, Link, Quote, Library, BookOpen, Camera } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { Author, Book, User } from '@/src/shared/api/types';
import { getBookTitle, getAuthorName } from '@/src/shared/lib/dataHelpers';
import { useData } from '@/src/app/providers/DataProvider';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { useAuth } from '@/src/app/providers/AuthContext';
import { ThemeColors } from '@/src/shared/theme';
import { supabase } from '@/src/shared/api/supabase';

interface UserRouteParam {
  id: number | string;
  name: string;
  username: string;
}

// Type pour une citation de la base de données globale
interface GlobalQuote {
  id: number;
  user: { id: string; name: string; username: string; };
  text: string;
  book: string | Book;
  author: string | Author;
  time?: string;
  date?: string;
  likes: number;
  comments: number;
  isLiked: boolean;
  isSaved: boolean;
}

type UserProfileScreenRouteProp = { user: User };

/**
 * Utility to convert base64 to ArrayBuffer for Supabase Storage
 * This is the most reliable way in React Native to avoid 0-byte uploads
 */
const decodeBase64 = (base64: string) => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

export default function UserProfileScreen() {
  const router = useRouter();
  const { username } = useLocalSearchParams<{ username?: string }>();
  const { getUserByUsername } = useData();
  const { colors } = useTheme();
  const { user: currentUser, updateProfile } = useAuth();

  const [profileData, setProfileData] = useState<User | null>(() => {
    if (username && currentUser?.username === username) return currentUser;
    if (!username) return currentUser;
    return null;
  });

  const styles = useMemo(() => createStyles(colors), [colors]);
  const isMe = currentUser?.username === profileData?.username;

  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedBio, setEditedBio] = useState('');
  const [editedWebsite, setEditedWebsite] = useState('');
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [userQuotes, setUserQuotes] = useState<GlobalQuote[]>([]);
  const [userBooks, setUserBooks] = useState<any[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);

  const groupedBooks = useMemo(() => {
    const groups: Record<string, any[]> = {
      'READING': [],
      'FINISHED': [],
      'TO_READ': [],
      'DROPPED': []
    };
    userBooks.forEach(ub => {
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

  useEffect(() => {
    const fetchProfile = async () => {
      // Determine if we are viewing our own profile
      const isViewingOwnProfile = !username || (username === currentUser?.username);
                                  
      // Use the special 'me' route for our own profile, otherwise use the specific username
      const usernameToFetch = isViewingOwnProfile ? 'me' : username;

      if (!usernameToFetch) {
        setIsLoading(false);
        return;
      }

      // If we already have some data for this user, we don't necessarily need to show the big loader
      const hasInitialData = profileData?.username === usernameToFetch || (isViewingOwnProfile && profileData === currentUser);
      if (!hasInitialData) {
        setIsLoading(true);
      }
      try {
        const data = await getUserByUsername(usernameToFetch);
        if (data) {
          setProfileData(data);
          if (data.quotes) {
            const mapped = data.quotes.map((q: any) => ({
              ...q,
              user: data,
              time: q.date ? new Date(q.date).toLocaleDateString() : 'Récemment'
            }));
            setUserQuotes(mapped);
          }
          if (data.library) {
            setUserBooks(data.library);
          }
        }
      } catch (e) {
        console.error("Error loading profile", e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [username, currentUser?.username]);

  const toggleFollow = () => {
    setIsFollowing(!isFollowing);
  };

  const handleEditToggle = () => {
    setEditedName(profileData?.name || '');
    setEditedBio(profileData?.bio || '');
    setEditedWebsite(profileData?.website || '');
    setEditedImage(profileData?.image || null);
    setIsEditing(true);
  };

  const pickImage = async () => {
    // Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Désolé, nous avons besoin de la permission d\'accéder à votre galerie pour changer votre photo !');
      return;
    }

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

      // Update local state
      setProfileData(prev => prev ? {
        ...prev,
        name: editedName,
        bio: editedBio,
        website: editedWebsite,
        image: imageUrl || prev.image
      } : null);

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

  if (!profileData && isLoading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#20B8CD" />
      </View>
    );
  }

  if (!profileData) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
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
          >
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>@{profileData?.username || username}</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Profile Section */}
          <View style={styles.profileHeader}>
            <TouchableOpacity
              style={styles.avatar}
              onPress={isEditing ? pickImage : undefined}
              disabled={!isEditing}
            >
              {editedImage || profileData.image ? (
                <Image
                  source={{ uri: editedImage || profileData.image }}
                  style={styles.avatarImage}
                />
              ) : (
                <Text style={styles.avatarText}>{profileData.name ? profileData.name[0] : '?'}</Text>
              )}

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
                  >
                    <Text style={styles.cancelButtonText}>Annuler</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={handleEditToggle}
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
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profileData.followers || 0}</Text>
              <Text style={styles.statLabel}>Abonnés</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profileData.following || 0}</Text>
              <Text style={styles.statLabel}>Abonnements</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{userQuotes.length}</Text>
              <Text style={styles.statLabel}>Citations</Text>
            </View>
          </View>

          {/* Bio & Links */}
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
                />
                <Text style={styles.inputLabel}>Site web</Text>
                <TextInput
                  style={styles.websiteInput}
                  value={editedWebsite}
                  onChangeText={setEditedWebsite}
                  placeholder="https://votre-site.com"
                  placeholderTextColor={colors.textTertiary}
                  autoCapitalize="none"
                />
              </View>
            ) : (
              <>
                <Text style={styles.bioText}>{profileData.bio || "Aucune description"}</Text>
                {profileData.website && profileData.website.length > 0 && (
                  <View style={styles.linksContainer}>
                    <TouchableOpacity style={styles.linkItem}>
                      <Link size={14} color={colors.primary} />
                      <Text style={styles.linkText}>{profileData.website}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
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
            ) : (
              <Text style={styles.placeholderText}>Cet utilisateur n'a pas encore de livres dans sa bibliothèque.</Text>
            )}
          </View>

          {/* User's Quotes */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Quote size={16} color={colors.primary} />
              <Text style={styles.sectionTitle}>Citations partagées</Text>
            </View>

            {userQuotes.length > 0 ? (
              <View style={styles.savedQuotesList}>
                {userQuotes.map((quote) => (
                    <TouchableOpacity
                      key={quote.id}
                      style={styles.savedQuoteCard}
                      onPress={() => router.navigate({ pathname: '/quote-detail', params: { quoteId: quote.id } })}
                    >
                    <Text style={styles.savedQuoteText} numberOfLines={3}>"{quote.text}"</Text>
                    <View style={styles.savedQuoteMeta}>
                      <View>
                        <Text style={styles.savedQuoteAuthor}>{getAuthorName(quote.author)}</Text>
                        <Text style={styles.savedQuoteBook}>{getBookTitle(quote.book)}</Text>
                      </View>
                      <Text style={styles.savedQuoteDate}>{quote.time}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={styles.placeholderText}>Cet utilisateur n'a pas encore partagé de citations.</Text>
            )}
          </View>
        </ScrollView>
      </View>
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
    width: 28,
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
    ...StyleSheet.absoluteFillObject,
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
  savedQuotesList: {
    gap: 12,
  },
  savedQuoteCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceHighlight,
    padding: 12,
  },
  savedQuoteText: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.text,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  savedQuoteMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  savedQuoteAuthor: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
  },
  savedQuoteBook: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 2,
  },
  savedQuoteDate: {
    fontSize: 12,
    color: colors.textTertiary,
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
});