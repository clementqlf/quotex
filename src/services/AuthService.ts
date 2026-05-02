import { User } from '../../types';
import { API_BASE_URL } from '../config/api';
import { StorageService, STORAGE_KEYS } from './StorageService';

export interface AuthResponse {
    user: User;
    token: string;
}

class AuthService {
    private readonly AUTH_URL = `${API_BASE_URL}/auth`;

    async login(email: string, password: string): Promise<AuthResponse> {
        const response = await fetch(`${this.AUTH_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to login');
        }

        const data: AuthResponse = await response.json();
        await this.saveAuthData(data);
        return data;
    }

    async register(username: string, email: string, password: string): Promise<AuthResponse> {
        const sanitizedUsername = username.startsWith('@') ? username.slice(1) : username;
        const response = await fetch(`${this.AUTH_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: sanitizedUsername, email, password }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to register');
        }

        const data: AuthResponse = await response.json();
        await this.saveAuthData(data);
        return data;
    }

    private async saveAuthData(data: AuthResponse) {
        await StorageService.setItem(STORAGE_KEYS.AUTH_TOKEN, data.token);
        await StorageService.setItem(STORAGE_KEYS.USER_DATA, data.user);
    }

    async logout() {
        await StorageService.removeItem(STORAGE_KEYS.AUTH_TOKEN);
        await StorageService.removeItem(STORAGE_KEYS.USER_DATA);
    }

    async updateUser(data: { username?: string; password?: string; name?: string; bio?: string; website?: string; image?: string }): Promise<User> {
        const token = await this.getToken();
        
        // Strip @ from username if present
        const sanitizedData = { ...data };
        if (sanitizedData.username && sanitizedData.username.startsWith('@')) {
            sanitizedData.username = sanitizedData.username.slice(1);
        }

        const response = await fetch(`${API_BASE_URL}/users/me`, {
            method: 'PATCH',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(sanitizedData),
        });

        if (!response.ok) {
            let errorMessage = 'Failed to update profile';
            const text = await response.text();
            try {
                const errorData = JSON.parse(text);
                errorMessage = errorData.error || errorMessage;
            } catch (e) {
                console.error('Non-JSON error response:', text);
                errorMessage = `Server Error (${response.status}): ${text.slice(0, 100)}...`;
            }
            throw new Error(errorMessage);
        }

        const updatedUser: User = await response.json();
        await StorageService.setItem(STORAGE_KEYS.USER_DATA, updatedUser);
        return updatedUser;
    }

    async getToken(): Promise<string | null> {
        return await StorageService.getItem<string>(STORAGE_KEYS.AUTH_TOKEN);
    }

    async getUser(): Promise<User | null> {
        return await StorageService.getItem<User>(STORAGE_KEYS.USER_DATA);
    }
}

export const authService = new AuthService();
