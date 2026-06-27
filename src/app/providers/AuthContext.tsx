import { useQueryClient } from '@tanstack/react-query';
import React, { createContext, useCallback, useContext, useEffect } from 'react';
import { authService, AuthResponse } from '../../entities/user/api/AuthService';
import { supabase } from '../../shared/api/supabase';
import { User } from '../../shared/api/types';
import { UGCModerationService } from '../../shared/api/UGCModerationService';
import * as Linking from 'expo-linking';
import { useAuthStore } from '@/src/shared/stores/authStore';

// Séparer les types de state pour éviter les re-renders inutiles
interface AuthState {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    isAuthenticated: boolean;
}

interface AuthActions {
    login: (email: string, password: string) => Promise<void>;
    register: (username: string, email: string, password: string, name?: string) => Promise<AuthResponse>;
    logout: () => Promise<void>;
    deleteAccount: () => Promise<void>;
    updateProfile: (data: { username?: string; password?: string; name?: string; bio?: string; website?: string; image?: string; expoPushToken?: string | null; notifyOnFollow?: boolean | null; notifyOnLike?: boolean | null }) => Promise<void>;
}

interface AuthContextType extends AuthState, AuthActions {}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const queryClient = useQueryClient();
    
    // Utiliser authStore comme source de vérité unique
    const { user, token, isLoading, isAuthenticated, setAuth, clearAuth, setLoading } = useAuthStore();

    useEffect(() => {
        // Load initial state
        UGCModerationService.init().catch(console.error);

        // Listen for auth state changes (decoupled)
        const unsubscribe = authService.onAuthStateChange(async (userProfile, sessionToken) => {
            try {
                if (userProfile && sessionToken) {
                    // Mettre à jour authStore au lieu du state local
                    setAuth(userProfile, sessionToken);
                    UGCModerationService.syncWithServer().catch(console.error);
                } else {
                    // Déconnecter via authStore
                    clearAuth();
                    queryClient.clear();
                }
            } catch (e) {
                console.error('[AuthContext] Error in onAuthStateChange:', e);
            } finally {
                setLoading(false);
            }
        });

        // 🔗 Deep Link Handler for Supabase Auth redirects (Confirmation / Password Reset)
        const parseSupabaseTokens = (url: string) => {
            try {
                const hashIndex = url.indexOf('#');
                const queryIndex = url.indexOf('?');
                let paramsString = '';
                
                if (hashIndex !== -1) {
                    paramsString = url.substring(hashIndex + 1);
                } else if (queryIndex !== -1) {
                    paramsString = url.substring(queryIndex + 1);
                }
                
                if (!paramsString) return null;
                
                const params: Record<string, string> = {};
                paramsString.split('&').forEach((part) => {
                    const [key, value] = part.split('=');
                    if (key && value) {
                        params[key] = decodeURIComponent(value);
                    }
                });
                
                if (params.access_token && params.refresh_token) {
                    return {
                        access_token: params.access_token,
                        refresh_token: params.refresh_token
                    };
                }
            } catch (e) {
                console.error('[AuthContext] Error parsing URL tokens:', e);
            }
            return null;
        };

        const handleDeepLink = async (url: string | null) => {
            if (!url) return;
            console.log('[AuthContext] Received deep link URL:', url);
            const tokens = parseSupabaseTokens(url);
            if (tokens) {
                console.log('[AuthContext] Found auth tokens in URL, signing in...');
                setLoading(true);
                try {
                    const { error } = await supabase.auth.setSession({
                        access_token: tokens.access_token,
                        refresh_token: tokens.refresh_token
                    });
                    if (error) throw error;
                    console.log('[AuthContext] Session established successfully from deep link');
                } catch (err) {
                    console.error('[AuthContext] Failed to set session from deep link:', err);
                    setLoading(false);
                }
            }
        };

        // Listen for links when the app is already open
        const subscription = Linking.addEventListener('url', (event) => {
            handleDeepLink(event.url);
        });

        // Handle link if the app was opened from a closed state
        Linking.getInitialURL().then((url) => {
            if (url) handleDeepLink(url);
        });

        return () => {
            unsubscribe();
            subscription.remove();
        };
    }, [queryClient, setAuth, clearAuth, setLoading]);

    // ⚡ Memoize les actions pour éviter leur recréation à chaque render
    const login = useCallback(async (email: string, password: string) => {
        const data = await authService.login(email, password);
        setAuth(data.user, data.token);
    }, [setAuth]);

    const register = useCallback(async (username: string, email: string, password: string, name?: string) => {
        const data = await authService.register(username, email, password, name);
        setAuth(data.user, data.token);
        return data;
    }, [setAuth]);

    const logout = useCallback(async () => {
        await authService.logout();
        clearAuth();
        queryClient.clear();
    }, [clearAuth, queryClient]);

    const deleteAccount = useCallback(async () => {
        await authService.deleteAccount();
        clearAuth();
        queryClient.clear();
    }, [clearAuth, queryClient]);

    const updateProfile = useCallback(async (data: { username?: string; password?: string; name?: string; bio?: string; website?: string; image?: string; expoPushToken?: string | null; notifyOnFollow?: boolean | null; notifyOnLike?: boolean | null }) => {
        const updatedUser = await authService.updateUser(data);
        setAuth(updatedUser, token); // Garder le même token, juste mettre à jour l'utilisateur
    }, [setAuth, token]);

    // Source de vérité unique : authStore
    // Pas besoin de useMemo car les valeurs viennent déjà de sources stables
    return (
        <AuthContext.Provider value={{
            user,
            token,
            isLoading,
            isAuthenticated,
            login,
            register,
            logout,
            deleteAccount,
            updateProfile,
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
