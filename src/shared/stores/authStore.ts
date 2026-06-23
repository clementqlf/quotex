import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/src/entities/user/model/User';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setAuth: (user: User | null, token: string | null) => void;
  clearAuth: () => void;
  setLoading: (isLoading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isLoading: true,
      isAuthenticated: false,
      setAuth: (user, token) => set({
        user,
        token,
        isLoading: false,
        isAuthenticated: !!token
      }),
      clearAuth: () => set({
        user: null,
        token: null,
        isLoading: false,
        isAuthenticated: false
      }),
      setLoading: (isLoading) => set({ isLoading }),
    }),
    { name: 'auth-storage' }
  )
);
