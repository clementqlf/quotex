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
import * as FileSystem from 'expo-file-system';
import { Author, Book, User } from '@/types';
import { getBookTitle, getAuthorName } from '@/src/utils/dataHelpers';
import { useData } from '@/src/contexts/DataProvider';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useAuth } from '@/src/contexts/AuthContext';
import { ThemeColors } from '@/src/theme/theme';

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

export default function UserProfileScreen() {
  const router = useRouter();
  const rawParams = useLocalSearchParams<{ user?: string }>();
  const user: User | null = useMemo(() => {
    try {
      return rawParams.user ? JSON.parse(rawParams.user as string) : null;
    } catch (e) {
      return null;
    }
  }, [rawParams.user]);

  const { getUserByUsername } = useData();
  const { colors } = useTheme();
  const { user: currentUser, updateProfile } = useAuth();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [profileData, setProfileData] = useState<User | null>(null);
  const isMe = currentUser?.username === user?.username || currentUser?.username === profileData?.username;

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
      const username = user?.username || profileData?.username;

      if (!username) {
        if (!user && !profileData) {
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      try {
        const data = await getUserByUsername(username);
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
        } else if (user) {
          setProfileData({ ...user });
        }
      } catch (e) {
        console.error("Error loading profile", e);
        if (user) setProfileData({ ...user });
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [user?.username]);

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

      const imageUri = manipResult.base64
        ? `data:image/jpeg;base64,${manipResult.base64}`
        : manipResult.uri;
      
      setEditedImage(imageUri);

      // Nettoyage des fichiers temporaires pour libérer l'espace "Documents & Données"
      try {
        await FileSystem.deleteAsync(originalUri, { idempotent: true });
        if (manipResult.uri && manipResult.uri !== originalUri) {
          await FileSystem.deleteAsync(manipResult.uri, { idempotent: true });
        }
      } catch (e) {
        console.log("Erreur lors de la suppression des fichiers temporaires:", e);
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
      await updateProfile({
        name: editedName,
        bio: editedBio,
        website: editedWebsite,
        image: editedImage || undefined
      });
      // Update local state
      setProfileData(prev => prev ? {
        ...prev,
        name: editedName,
        bio: editedBio,
        website: editedWebsite,
        image: editedImage || prev.image
      } : null);
      console.log("Profile updated successfully");
      setIsEditing(false);
    } catch (e) {
      console.error("Error saving profile", e);
      alert("Erreur lors de la sauvegarde du profil");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !profileData) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#20B8CD" />
      </View>
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
          <Text style={styles.headerTitle} numberOfLines={1}>@{profileData?.username || user?.username}</Text>
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
                            onPress={() => router.push({ pathname: '/book-detail', params: { book: JSON.stringify(book) } })}
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
                    onPress={() => router.navigate({ pathname: '/quote-detail', params: { quote: JSON.stringify(quote) } })}
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