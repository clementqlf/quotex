import React from 'react';
import { useAuth } from './AuthContext';
import { useSegments, useRouter, Redirect } from 'expo-router';
import SplashScreen from '@/src/shared/ui/AnimatedSplashScreen';

/**
 * AuthGuard - Composant de protection des routes authentifiées
 * Ce composant centralise la logique de redirection basée sur l'état d'authentification
 * 
 * @param children - Les enfants à rendre si l'utilisateur a les droits d'accès
 * @returns Les enfants si autorisé, sinon une redirection ou un écran de chargement
 */
export const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isAuthenticated, isLoading } = useAuth();
    const segments = useSegments();
    const router = useRouter();

    // Vérifier si nous sommes dans un groupe d'authentification
    const inAuthGroup = segments.some(
        (segment) => 
            segment === '(auth)' || 
            segment === 'login' || 
            segment === 'register' ||
            segment === 'login-password' ||
            segment === 'register-details'
    );

    // Si nous sommes encore en train de charger l'état d'auth, afficher le splash
    if (isLoading) {
        return <SplashScreen isDark={false} isLoading={true} onAnimationFinish={() => {}} />;
    }

    // Si l'utilisateur n'est pas authentifié et essaie d'accéder à une route protégée
    if (!isAuthenticated && !inAuthGroup) {
        console.log('[AuthGuard] Redirecting to /login - User not authenticated');
        return <Redirect href="/login" />;
    }

    // Si l'utilisateur est authentifié et essaie d'accéder à une route d'auth
    if (isAuthenticated && inAuthGroup) {
        console.log('[AuthGuard] Redirecting to / - User already authenticated');
        return <Redirect href="/" />;
    }

    // Si tout est OK, rendre les enfants
    return <>{children}</>;
};

/**
 * Hook pour vérifier si l'utilisateur est dans un groupe d'authentification
 */
export const useIsInAuthGroup = (): boolean => {
    const segments = useSegments();
    return segments.some(
        (segment) => 
            segment === '(auth)' || 
            segment === 'login' || 
            segment === 'register' ||
            segment === 'onboarding'
    );
};

/**
 * Hook pour vérifier si l'utilisateur a le droit d'accéder à la route actuelle
 */
export const useRouteAccess = (): { 
    hasAccess: boolean; 
    isLoading: boolean; 
    requiresAuth: boolean; 
} => {
    const { isAuthenticated, isLoading } = useAuth();
    const segments = useSegments();

    const inAuthGroup = segments.some(
        (segment) => 
            segment === '(auth)' || 
            segment === 'login' || 
            segment === 'register' ||
            segment === 'onboarding'
    );

    // Les routes dans le groupe (auth) ne nécessitent PAS d'authentification
    const requiresAuth = !inAuthGroup;

    // Si nous sommes encore en train de charger, considérer que nous n'avons pas accès
    if (isLoading) {
        return { hasAccess: false, isLoading: true, requiresAuth };
    }

    // Si la route nécessite l'auth et l'utilisateur n'est pas authentifié
    if (requiresAuth && !isAuthenticated) {
        return { hasAccess: false, isLoading: false, requiresAuth };
    }

    // Si la route ne nécessite pas l'auth mais l'utilisateur est authentifié (ex: /login)
    if (!requiresAuth && isAuthenticated) {
        return { hasAccess: false, isLoading: false, requiresAuth };
    }

    // Sinon, accès autorisé
    return { hasAccess: true, isLoading: false, requiresAuth };
};
