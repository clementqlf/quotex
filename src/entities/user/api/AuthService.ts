import { User } from '@/src/shared/api/types';
import { API_BASE_URL } from '@/src/shared/config/api';
import { StorageService, STORAGE_KEYS } from '@/src/shared/api/StorageService';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { supabase } from '@/src/shared/api/supabase';

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
            return { id: userId, username: '' };
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

    async deleteAccount(): Promise<void> {
        const session = (await supabase.auth.getSession()).data.session;
        if (!session) throw new Error('Not authenticated');

        const response = await fetch(`${API_BASE_URL}/users/me`, {
            method: 'DELETE',
            headers: { 
                'Authorization': `Bearer ${session.access_token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Failed to delete account' }));
            throw new Error(errorData.error || 'Failed to delete account');
        }

        await this.logout();
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

    /**
     * Native Google Sign In
     */
    async signInWithGoogleNative(): Promise<void> {
        try {
            await GoogleSignin.hasPlayServices();
            const userInfo = await GoogleSignin.signIn();
            
            if (userInfo.data?.idToken) {
                // IMPORTANT: Ensure "Skip nonce checks" is enabled in Supabase Dashboard -> Auth -> Providers -> Google
                // This is required because the native SDK often includes a nonce that we can't easily match.
                const { error } = await supabase.auth.signInWithIdToken({
                    provider: 'google',
                    token: userInfo.data.idToken,
                });
                
                if (error) throw error;

                // After successful auth, fetch and cache the profile
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const profile = await this.fetchProfile(user.id);
                    await this.saveAuthData({ 
                        user: profile, 
                        token: (await supabase.auth.getSession()).data.session?.access_token || null 
                    });
                }
            } else {
                throw new Error('No ID Token found');
            }
        } catch (error: any) {
            console.error('Google Native Sign In Error:', error);
            throw error;
        }
    }

    /**
     * OAuth Sign In (Google, Apple, etc.) - Browser fallback
     */
    async signInWithOAuth(provider: 'google' | 'apple'): Promise<void> {
        const redirectTo = Linking.createURL('/auth/callback');
        
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo,
                skipBrowserRedirect: true,
            },
        });

        if (error) throw error;

        const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

        if (res.type === 'success') {
            const { url } = res;
            const params = Linking.parse(url);
            
            if (params.queryParams?.access_token) {
                // If the URL contains tokens, we can set the session
                const { error: sessionError } = await supabase.auth.setSession({
                    access_token: params.queryParams.access_token as string,
                    refresh_token: params.queryParams.refresh_token as string,
                });
                if (sessionError) throw sessionError;
            }
        }
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
