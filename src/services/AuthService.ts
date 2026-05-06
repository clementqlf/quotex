import { User } from '../../types';
import { API_BASE_URL } from '../config/api';
import { StorageService, STORAGE_KEYS } from './StorageService';
import { supabase } from '../lib/supabase';

export interface AuthResponse {
    user: User | null;
    token: string | null;
}

class AuthService {
    /**
     * Check if an email already exists in Supabase Auth
     */
    async checkEmailExists(email: string): Promise<boolean> {
        console.log('[AuthService] Checking email existence for:', email);
        try {
            const { data, error } = await supabase.functions.invoke('check-email', {
                body: { email: email.toLowerCase() }
            });
            if (error) {
                console.error('[AuthService] Edge Function error:', error);
                throw error;
            }
            console.log('[AuthService] Email exists result:', data?.exists);
            return !!data?.exists;
        } catch (err) {
            console.error('[AuthService] Error checking email existence:', err);
            return false; // Fallback to safe default
        }
    }

    /**
     * Login using Supabase Auth
     */
    async login(email: string, password: string): Promise<AuthResponse> {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) throw error;

        // Fetch the profile from our public.Profile table
        const userProfile = await this.fetchProfile(data.user.id);
        
        const authData: AuthResponse = {
            user: userProfile,
            token: data.session?.access_token || null,
        };
        
        await this.saveAuthData(authData);
        return authData;
    }

    /**
     * Register using Supabase Auth
     */
    async register(username: string, email: string, password: string): Promise<AuthResponse> {
        const sanitizedUsername = username.startsWith('@') ? username.slice(1) : username;
        
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    username: sanitizedUsername,
                }
            }
        });

        if (error) throw error;

        // Note: The public.Profile is created automatically via SQL Trigger on auth.users insert
        const userProfile = await this.fetchProfile(data.user!.id);

        const authData: AuthResponse = {
            user: userProfile,
            token: data.session?.access_token || null,
        };

        await this.saveAuthData(authData);
        return authData;
    }

    private async fetchProfile(userId: string): Promise<User> {
        const { data, error } = await supabase
            .from('Profile')
            .select('*')
            .eq('id', userId)
            .single();

        if (error || !data) {
            // Fallback to minimal data if profile not yet created
            return { id: userId, username: 'user' };
        }
        return data as User;
    }

    private async saveAuthData(data: AuthResponse) {
        if (data.user) {
            await StorageService.setItem(STORAGE_KEYS.USER_DATA, data.user);
        }
    }

    async logout() {
        await supabase.auth.signOut();
        await StorageService.removeItem(STORAGE_KEYS.USER_DATA);
    }

    async updateUser(data: { username?: string; name?: string; bio?: string; website?: string; image?: string }): Promise<User> {
        const session = (await supabase.auth.getSession()).data.session;
        if (!session) throw new Error('Not authenticated');

        // Strip @ from username if present
        const sanitizedData = { ...data };
        if (sanitizedData.username && sanitizedData.username.startsWith('@')) {
            sanitizedData.username = sanitizedData.username.slice(1);
        }

        const response = await fetch(`${API_BASE_URL}/users/me`, {
            method: 'PATCH',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify(sanitizedData),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Failed to update profile' }));
            throw new Error(errorData.error || 'Failed to update profile');
        }

        const updatedUser: User = await response.json();
        await StorageService.setItem(STORAGE_KEYS.USER_DATA, updatedUser);
        return updatedUser;
    }

    async getToken(): Promise<string | null> {
        const { data: { session } } = await supabase.auth.getSession();
        return session?.access_token || null;
    }

    async getUser(): Promise<User | null> {
        // First try the session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return null;

        // Then try our local cache for the profile
        const cached = await StorageService.getItem<User>(STORAGE_KEYS.USER_DATA);
        if (cached && cached.id === session.user.id) return cached;

        // Otherwise fetch fresh
        const profile = await this.fetchProfile(session.user.id);
        await StorageService.setItem(STORAGE_KEYS.USER_DATA, profile);
        return profile;
    }
}

export const authService = new AuthService();
