import AsyncStorage from '@react-native-async-storage/async-storage';

const BLOCKED_USERS_KEY = '@ugc_blocked_users';
const REPORTED_REVIEWS_KEY = '@ugc_reported_reviews';

export const UGCModerationService = {
    // 1. Filtrage de base (à améliorer côté serveur idéalement)
    containsOffensiveContent(text: string): boolean {
        if (!text) return false;
        
        // Liste basique de mots interdits (à enrichir selon les besoins)
        const badWords = [
            'insulte1', 'insulte2', 'raciste', 'haineux', 'connard', 'salope', 'putain', 'merde'
            // Ajoutez ici d'autres mots ou utilisez une bibliothèque dédiée
        ];
        
        const lowerText = text.toLowerCase();
        return badWords.some(word => lowerText.includes(word));
    },

    // 2. Bloquer un utilisateur
    async blockUser(userId: string | number): Promise<void> {
        try {
            const blocked = await this.getBlockedUsers();
            const idStr = String(userId);
            if (!blocked.includes(idStr)) {
                blocked.push(idStr);
                await AsyncStorage.setItem(BLOCKED_USERS_KEY, JSON.stringify(blocked));
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
    async reportReview(reviewId: string | number): Promise<void> {
        try {
            const reported = await this.getReportedReviews();
            const idStr = String(reviewId);
            if (!reported.includes(idStr)) {
                reported.push(idStr);
                await AsyncStorage.setItem(REPORTED_REVIEWS_KEY, JSON.stringify(reported));
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
    }
};
