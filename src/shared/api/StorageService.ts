import AsyncStorage from '@react-native-async-storage/async-storage';

export const STORAGE_KEYS = {
    QUOTES: 'quotes_data',
    AUTHORS: 'authors_data',
    BOOKS: 'books_data',
    BLOCK_LAYOUTS: 'block_layouts',
    BLOCK_DATA: 'block_data',
    PENDING_QUOTES: 'pending_quotes',
    AUTH_TOKEN: 'auth_token',
    USER_DATA: 'user_data',
};

export const StorageService = {
    async getItem<T>(key: string): Promise<T | null> {
        try {
            const jsonValue = await AsyncStorage.getItem(key);
            return jsonValue != null ? JSON.parse(jsonValue) : null;
        } catch (e) {
            console.error('Error reading value', e);
            return null;
        }
    },

    async setItem<T>(key: string, value: T): Promise<void> {
        try {
            const jsonValue = JSON.stringify(value);
            await AsyncStorage.setItem(key, jsonValue);
        } catch (e) {
            console.error('Error saving value', e);
        }
    },

    async removeItem(key: string): Promise<void> {
        try {
            await AsyncStorage.removeItem(key);
        } catch (e) {
            console.error('Error removing value', e);
        }
    },

    async clearAll(): Promise<void> {
        try {
            await AsyncStorage.clear();
        } catch (e) {
            console.error('Error clearing storage', e);
        }
    }
};
