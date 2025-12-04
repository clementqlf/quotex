import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useNavigation, useRoute, RouteProp, NavigationProp } from '@react-navigation/native';
import { ChevronLeft, Mail, Link } from 'lucide-react-native';
import { RootStackParamList, User, AnyQuote } from '../types';
import { globalQuotesDB, userProfilesDB, UserProfile } from '../data/staticData'; // Import de la DB globale

type UserProfileScreenRouteProp = RouteProp<RootStackParamList, 'UserProfile'>;

export function UserProfileScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<UserProfileScreenRouteProp>();
  const { user } = route.params;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userQuotes, setUserQuotes] = useState<AnyQuote[]>([]);
  const [loading, setLoading] = useState(true);

  // Si l'utilisateur ou son ID est manquant, on ne peut pas continuer.
  if (!user || !user.id) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <ChevronLeft size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <Text style={styles.placeholderText}>
            Impossible de charger le profil. L'identifiant de l'utilisateur est manquant.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  useEffect(() => {
    const fetchUserProfile = () => {
      try {
        const data = userProfilesDB[user.id];

        if (!data) {
          // Créer un profil par défaut si non trouvé dans le JSON
          // pour que l'écran puisse quand même s'afficher
          setProfile({ id: user.id, bio: `Bienvenue sur le profil de ${user.name}.`, website: '', stats: { citations: 0, followers: 0, following: 0 } });
        } else {
          setProfile(data);
        }

        // Filtre les citations de la DB globale pour cet utilisateur
        const quotes = globalQuotesDB.filter(q => String(q.user.id) === String(user.id));
        setUserQuotes(quotes);
      } catch (error) {
        console.error("Erreur lors de la récupération du profil:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [user.id, user.name]); // Dépendance plus spécifique

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('');
  };

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
          <Text style={styles.headerTitle} numberOfLines={1}>{user.name}</Text>
          <View style={styles.placeholder} />
        </View>

        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#20B8CD" />
          </View>
        ) : !profile ? (
          <Text style={styles.placeholderText}>Impossible de charger le profil.</Text>
        ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Profile Header */}
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(user.name)}</Text>
            </View>
            <Text style={styles.userName}>{user.name}</Text>
            <Text style={styles.userUsername}>{user.username}</Text>
            
            <TouchableOpacity style={styles.followButton}>
              <Text style={styles.followButtonText}>Suivre</Text>
            </TouchableOpacity>
          </View>

          {/* Bio */}
          <View style={styles.section}>
             <Text style={styles.bioText}>{profile.bio}</Text>
             <View style={styles.linksContainer}>
                <View style={styles.linkItem}>
                    <Mail size={14} color="#6B7280" />
                    <Text style={styles.linkText}>Contacter</Text>
                </View>
                <View style={styles.linkItem}>
                    <Link size={14} color="#6B7280" />
                    <Text style={styles.linkText}>{profile.website}</Text>
                </View>
             </View>
          </View>

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{userQuotes.length}</Text>
              <Text style={styles.statLabel}>Citations</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile.stats.followers}</Text>
              <Text style={styles.statLabel}>Abonnés</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile.stats.following}</Text>
              <Text style={styles.statLabel}>Abonnements</Text>
            </View>
          </View>

          {/* User's quotes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Citations de {user.name.split(' ')[0]}</Text>
            {userQuotes.length > 0 ? (
              <FlatList
                data={userQuotes}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item: quote }) => (
                  <TouchableOpacity 
                    style={styles.quoteItem}
                    onPress={() => navigation.navigate('QuoteDetail', { quote })}
                  >
                    <Text style={styles.quoteText}>“{quote.text}”</Text>
                    <Text style={styles.quoteAuthor}>— {quote.author}</Text>
                  </TouchableOpacity>
                )}
                scrollEnabled={false}
              />
            ) : (
              <Text style={styles.placeholderText}>Cet utilisateur n'a pas encore partagé de citations.</Text>
            )}
          </View>
        </ScrollView>
        )}
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
  },
  placeholder: {
    width: 28,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
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
    fontSize: 24,
    color: '#20B8CD',
  },
  userName: {
    fontSize: 20,
    color: '#FFFFFF',
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
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  followButtonText: {
    color: '#0F0F0F',
    fontSize: 14,
    fontWeight: 'bold',
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
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 12,
  },
  placeholderText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingVertical: 24,
  },
  quoteItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  quoteText: {
    color: '#E5E7EB',
    fontSize: 14,
    lineHeight: 20,
  },
});