import React, { createContext, useState, useContext, useEffect } from 'react';
import { authService } from '../services/AuthService';
import { User } from '../../types';

interface AuthContextType {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (username: string, email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    updateProfile: (data: { username?: string; password?: string; name?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadStoredAuth();
    }, []);

    const loadStoredAuth = async () => {
        try {
            const [storedUser, storedToken] = await Promise.all([
                authService.getUser(),
                authService.getToken()
            ]);
            if (storedUser && storedToken) {
                setUser(storedUser);
                setToken(storedToken);
            }
        } catch (e) {
            console.error('Failed to load auth data', e);
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (email: string, password: string) => {
        const data = await authService.login(email, password);
        setUser(data.user);
        setToken(data.token);
    };

    const register = async (username: string, email: string, password: string) => {
        const data = await authService.register(username, email, password);
        setUser(data.user);
        setToken(data.token);
    };

    const logout = async () => {
        await authService.logout();
        setUser(null);
        setToken(null);
    };

    const updateProfile = async (data: { username?: string; password?: string; name?: string }) => {
        const updatedUser = await authService.updateUser(data);
        setUser(updatedUser);
    };

    return (
        <AuthContext.Provider value={{ 
            user, 
            token, 
            isLoading, 
            isAuthenticated: !!token, 
            login, 
            register, 
            logout,
            updateProfile
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
