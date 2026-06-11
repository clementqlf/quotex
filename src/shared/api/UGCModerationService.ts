import AsyncStorage from '@react-native-async-storage/async-storage';
import { httpClient } from './HttpClient';

const BLOCKED_USERS_KEY = '@ugc_blocked_users';
const REPORTED_REVIEWS_KEY = '@ugc_reported_reviews';
const FORBIDDEN_WORDS_KEY = '@ugc_forbidden_words';

// Liste de repli si le cache n'a pas encore été synchronisé
let cachedBadWords: string[] = [
    'insulte1', 'insulte2', 'raciste', 'haineux', 'connard', 'salope', 'putain', 'merde'
];

export const UGCModerationService = {
    // Initialise les mots interdits depuis le cache local (AsyncStorage)
    async init(): Promise<void> {
        try {
            const data = await AsyncStorage.getItem(FORBIDDEN_WORDS_KEY);
            if (data) {
                cachedBadWords = JSON.parse(data);
            }
        } catch (error) {
            console.error('Erreur lors du chargement des mots interdits du cache:', error);
        }
    },

    // 1. Filtrage de base (en mémoire / local)
    containsOffensiveContent(text: string): boolean {
        if (!text) return false;
        
        return cachedBadWords.some(word => {
            const escapedWord = word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            // Recherche le mot entouré par des caractères non-alphanumériques (lettres accentuées françaises incluses)
            const regex = new RegExp(`(?:^|[^a-zA-Z0-9àâäéèêëîïôöùûüçÂÆÇÉÈŒ])(${escapedWord})(?:$|[^a-zA-Z0-9àâäéèêëîïôöùûüçÂÆÇÉÈŒ])`, 'i');
            return regex.test(text);
        });
    },

    // 2. Bloquer un utilisateur
    async blockUser(userId: string | number): Promise<void> {
        try {
            const blocked = await this.getBlockedUsers();
            const idStr = String(userId);
            if (!blocked.includes(idStr)) {
                blocked.push(idStr);
                await AsyncStorage.setItem(BLOCKED_USERS_KEY, JSON.stringify(blocked));
                
                // Envoi au backend (en arrière-plan)
                httpClient.post('/moderation/blocks', { blockedId: idStr })
                    .catch(e => console.error('Erreur API blocage:', e));
            }
        } catch (error) {
            console.error('Erreur lors du blocage de l\'utilisateur:', error);
        }
    },

    async getBlockedUsers(): Promise<string[]> {
        try {
            const data = await AsyncStorage.getItem(BLOCKED_USERS_KEY);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Erreur lors de la récupération des utilisateurs bloqués:', error);
            return [];
        }
    },

    // 3. Signaler un contenu
    async reportReview(reviewId: string | number, reason: string = 'Inapproprié'): Promise<void> {
        try {
            const reported = await this.getReportedReviews();
            const idStr = String(reviewId);
            if (!reported.includes(idStr)) {
                reported.push(idStr);
                await AsyncStorage.setItem(REPORTED_REVIEWS_KEY, JSON.stringify(reported));
                
                // Envoi au backend (en arrière-plan)
                httpClient.post('/moderation/reports', { reviewId: idStr, reason })
                    .catch(e => console.error('Erreur API signalement:', e));
            }
        } catch (error) {
            console.error('Erreur lors du signalement de l\'avis:', error);
        }
    },

    async getReportedReviews(): Promise<string[]> {
        try {
            const data = await AsyncStorage.getItem(REPORTED_REVIEWS_KEY);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Erreur lors de la récupération des avis signalés:', error);
            return [];
        }
    },

    // 4. Synchronisation au démarrage / login
    async syncWithServer(): Promise<void> {
        try {
            // Synchronise les blocages et signalements
            const data = await httpClient.get<{ blockedIds: string[], reportedReviewIds: string[] }>('/moderation/sync');
            if (data) {
                if (data.blockedIds) {
                    await AsyncStorage.setItem(BLOCKED_USERS_KEY, JSON.stringify(data.blockedIds));
                }
                if (data.reportedReviewIds) {
                    await AsyncStorage.setItem(REPORTED_REVIEWS_KEY, JSON.stringify(data.reportedReviewIds));
                }
            }

            // Synchronise également les mots interdits
            const wordsData = await httpClient.get<{ words: string[] }>('/moderation/forbidden-words');
            if (wordsData && wordsData.words) {
                await AsyncStorage.setItem(FORBIDDEN_WORDS_KEY, JSON.stringify(wordsData.words));
                cachedBadWords = wordsData.words;
            }
        } catch (error) {
            console.error('Erreur lors de la synchronisation de la modération:', error);
        }
    }
};
