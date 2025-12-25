import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { ChevronLeft, Mail, Link, Quote } from 'lucide-react-native';
import { RootStackParamList, Author, Book, User } from '../types';
// import UserProfiles from '../mock/user-profiles.json'; // Removed
// import { globalQuotesDB } from '../data/staticData'; // Removed direct import
import { getBookTitle, getAuthorName } from '../src/utils/dataHelpers';
import { useData } from '../src/contexts/DataProvider';

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

type UserProfileScreenRouteProp = RouteProp<RootStackParamList, 'UserProfile'>;

export function UserProfileScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<UserProfileScreenRouteProp>();
  const { user } = route.params;
  const { getUserByUsername } = useData();

  const [isLoading, setIsLoading] = useState(true);
  const [profileData, setProfileData] = useState<User | null>(null);
  const [userQuotes, setUserQuotes] = useState<GlobalQuote[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      setIsLoading(true);
      try {
        const data = await getUserByUsername(user.username);
        if (data) {
          setProfileData(data);
          // If backend returns quotes, use them
          if (data.quotes) {
            const mapped = data.quotes.map((q: any) => ({
              ...q,
              user: data, // Ensure user object is attached
              time: q.date ? new Date(q.date).toLocaleDateString() : 'Récemment'
            }));
            setUserQuotes(mapped);
          }
        } else {
          // Fallback for demo or if not found (shouldn't happen if migrated correctly)
          setProfileData({ ...user } as User);
        }
      } catch (e) {
        console.error("Error loading profile", e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  const toggleFollow = () => {
    setIsFollowing(!isFollowing);
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
            onPress={() => navigation.goBack()}
          >
            <ChevronLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{user.username}</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Profile Section */}
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{profileData.name[0]}</Text>
            </View>
            <Text style={styles.userName}>{profileData.name}</Text>
            <Text style={styles.userUsername}>@{profileData.username}</Text>

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
            <Text style={styles.bioText}>{profileData.bio}</Text>
            {profileData.website && profileData.website.length > 0 && (
              <View style={styles.linksContainer}>
                <TouchableOpacity style={styles.linkItem}>
                  <Link size={14} color="#20B8CD" />
                  <Text style={styles.linkText}>{profileData.website}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* User's Quotes */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Quote size={16} color="#20B8CD" />
              <Text style={styles.sectionTitle}>Citations partagées</Text>
            </View>

            {userQuotes.length > 0 ? (
              <View style={styles.savedQuotesList}>
                {userQuotes.map((quote) => (
                  <TouchableOpacity
                    key={quote.id}
                    style={styles.savedQuoteCard}
                    onPress={() => navigation.navigate('QuoteDetail', { quote })}
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F0F0F',
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
    borderBottomColor: '#1F1F1F',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    color: '#FFFFFF',
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
    backgroundColor: '#0F0F0F',
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
    backgroundColor: 'rgba(32, 184, 205, 0.1)',
    borderWidth: 2,
    borderColor: '#20B8CD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    color: '#20B8CD',
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userUsername: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  followButton: {
    backgroundColor: '#20B8CD',
    paddingVertical: 8,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  followButtonActive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#20B8CD',
  },
  followButtonText: {
    color: '#0F0F0F',
    fontSize: 14,
    fontWeight: 'bold',
  },
  followButtonTextActive: {
    color: '#20B8CD',
  },
  section: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  bioText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#E5E7EB',
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
    color: '#20B8CD',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    color: '#20B8CD',
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 14,
    color: '#FFFFFF',
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
    color: '#6B7280',
    textAlign: 'center',
    paddingVertical: 24,
  },
  savedQuotesList: {
    gap: 12,
  },
  savedQuoteCard: {
    backgroundColor: '#121212',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    padding: 12,
  },
  savedQuoteText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#E5E7EB',
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
    color: '#20B8CD',
    fontWeight: '500',
  },
  savedQuoteBook: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  savedQuoteDate: {
    fontSize: 12,
    color: '#6B7280',
  },
});