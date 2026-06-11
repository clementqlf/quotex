import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';
import { authService } from '../../entities/user/api/AuthService';
import { User } from '../../shared/api/types';
import { UGCModerationService } from '../../shared/api/UGCModerationService';
import { useQueryClient } from '@tanstack/react-query';

// Séparer les types de state pour éviter les re-renders inutiles
interface AuthState {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    isAuthenticated: boolean;
}

interface AuthActions {
    login: (email: string, password: string) => Promise<void>;
    register: (username: string, email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    deleteAccount: () => Promise<void>;
    updateProfile: (data: { username?: string; password?: string; name?: string; bio?: string; website?: string; image?: string }) => Promise<void>;
}

interface AuthContextType extends AuthState, AuthActions {}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const queryClient = useQueryClient();
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Load initial state
        UGCModerationService.init().catch(console.error);

        // Listen for auth state changes (decoupled)
        const unsubscribe = authService.onAuthStateChange(async (userProfile, sessionToken) => {
            try {
                if (userProfile && sessionToken) {
                    setToken(sessionToken);
                    setUser(userProfile);
                    UGCModerationService.syncWithServer().catch(console.error);
                } else {
                    setUser(null);
                    setToken(null);
                    queryClient.clear();
                }
            } catch (e) {
                console.error('[AuthContext] Error in onAuthStateChange:', e);
            } finally {
                setIsLoading(false);
            }
        });

        return () => {
            unsubscribe();
        };
    }, [queryClient]);

    // ⚡ Memoize les actions pour éviter leur recréation à chaque render
    const login = useCallback(async (email: string, password: string) => {
        const data = await authService.login(email, password);
        setUser(data.user);
        setToken(data.token);
    }, []);

    const register = useCallback(async (username: string, email: string, password: string) => {
        const data = await authService.register(username, email, password);
        setUser(data.user);
        setToken(data.token);
    }, []);

    const logout = useCallback(async () => {
        await authService.logout();
        setUser(null);
        setToken(null);
        queryClient.clear();
    }, [queryClient]);

    const deleteAccount = useCallback(async () => {
        await authService.deleteAccount();
        setUser(null);
        setToken(null);
        queryClient.clear();
    }, [queryClient]);

    const updateProfile = useCallback(async (data: { username?: string; password?: string; name?: string; bio?: string; website?: string; image?: string }) => {
        const updatedUser = await authService.updateUser(data);
        setUser(updatedUser);
    }, []);

    // ✅ Séparer le state et les actions dans des objets memoized distincts
    const authState = useMemo(() => ({
        user,
        token,
        isLoading,
        isAuthenticated: !!token,
    }), [user, token, isLoading]);

    const authActions = useMemo(() => ({
        login,
        register,
        logout,
        deleteAccount,
        updateProfile,
    }), [login, register, logout, deleteAccount, updateProfile]);

    // ✅ Combiner les deux objets dans le contexte
    const contextValue = useMemo(() => ({
        ...authState,
        ...authActions,
    }), [authState, authActions]);

    return (
        <AuthContext.Provider value={contextValue}>
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
