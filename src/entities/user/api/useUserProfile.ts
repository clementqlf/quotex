import { useAuth } from '@/src/app/providers/AuthContext';
import { useQuote } from '@/src/entities/quote/providers/QuoteProvider';
import { User } from '@/src/shared/api/types';
import { useQuery } from '@tanstack/react-query';

export function useUserProfile(usernameParam?: string) {
  const { user: currentUser } = useAuth();
  const { getUserByUsername } = useQuote();

  // Déterminer si l'on regarde son propre profil
  const isViewingOwnProfile = !usernameParam || 
    (currentUser?.username && currentUser.username.replace('@', '') === usernameParam.replace('@', ''));
  
  const usernameToFetch = isViewingOwnProfile ? 'me' : usernameParam;
  const profileQueryKey = isViewingOwnProfile ? `me_${currentUser?.id || 'none'}` : usernameParam;

  return useQuery({
    queryKey: ['userProfile', profileQueryKey],
    queryFn: async () => {
      if (!usernameToFetch) return null;
      const data = await getUserByUsername(usernameToFetch);
      if (!data) throw new Error('User not found');
      return data;
    },
    enabled: !!usernameToFetch,
    // Injecter immédiatement les données de base en tant que placeholder si c'est notre propre profil
    // afin d'éviter tout flash ou temps de chargement, tout en forçant la récupération en arrière-plan
    placeholderData: isViewingOwnProfile && currentUser ? currentUser as User : undefined,
    staleTime: 1000 * 5, // Garder en cache pendant 5 secondes pour une réactualisation rapide
  });
}
