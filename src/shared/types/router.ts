/**
 * Types pour les paramètres de routage Expo Router
 * Centralise tous les types de paramètres utilisés dans l'application
 */

// ============================================================================
// Paramètres globaux
// ============================================================================

export interface GlobalSearchParams {
    // Paramètres globaux qui peuvent apparaître sur n'importe quelle route
    theme?: string;
    [key: string]: string | undefined;
}

// ============================================================================
// Paramètres pour le groupe (app)
// ============================================================================

// Paramètres pour l'index (home)
export type AppIndexParams = Record<string, never>;

// Paramètres pour la page de recherche
export interface SearchParams {
    query?: string;
    filter?: string;
    sort?: string;
}

// ============================================================================
// Paramètres pour les détails des entités
// ============================================================================

// Paramètres pour les détails d'un auteur
export interface AuthorDetailParams {
    authorId?: number | string;
    authorName?: string;
    name?: string;
    author?: string; // Peut être JSON.stringified
    inventaireUri?: string;
}

// Paramètres pour les détails d'un livre
export interface BookDetailParams {
    bookId?: number | string;
    bookTitle?: string;
    title?: string;
    book?: string; // Peut être JSON.stringified
    inventaireUri?: string;
    cover?: string;
}

// Paramètres pour les détails d'une citation
export interface QuoteDetailParams {
    quoteId?: number | string;
    quote?: string; // Peut être JSON.stringified
}

// Paramètres pour les détails d'un thème
export interface ThemeDetailParams {
    themeId?: number | string;
    themeName?: string;
}

// Paramètres pour les détails d'un prix littéraire
export interface PrizeDetailParams {
    prizeId?: number | string;
}

// Paramètres pour le profil utilisateur
export interface UserProfileParams {
    userId?: string;
    username?: string;
}

// Paramètres pour le scanner
export type ScanParams = Record<string, never>;

// Paramètres pour les paramètres
export type SettingsParams = Record<string, never>;

// ============================================================================
// Paramètres pour le groupe (auth)
// ============================================================================

// Paramètres pour la connexion
export interface LoginParams {
    redirect?: string;
    error?: string;
}

// Paramètres pour l'inscription (étapes)
export interface RegisterParams {
    step?: string;
    email?: string;
    error?: string;
}

// Paramètres pour la connexion par mot de passe
export interface LoginPasswordParams {
    email?: string;
    redirect?: string;
}

// Paramètres pour les détails de l'inscription
export interface RegisterDetailsParams {
    email?: string;
    username?: string;
}

// ============================================================================
// Union de tous les paramètres possibles
// ============================================================================

/**
 * Tous les paramètres possibles pour les routes de l'application
 * Utilisé pour typer useGlobalSearchParams()
 */
export type RootLayoutParams = 
    // Global
    GlobalSearchParams &
    
    // App
    AppIndexParams &
    SearchParams &
    AuthorDetailParams &
    BookDetailParams &
    QuoteDetailParams &
    ThemeDetailParams &
    PrizeDetailParams &
    UserProfileParams &
    ScanParams &
    SettingsParams &
    
    // Auth
    LoginParams &
    RegisterParams &
    LoginPasswordParams &
    RegisterDetailsParams;

// ============================================================================
// Types pour les routes spécifiques
// ============================================================================

// Type pour la route author-detail
export type AuthorDetailRouteParams = {
    params: AuthorDetailParams;
};

// Type pour la route book-detail
export type BookDetailRouteParams = {
    params: BookDetailParams;
};

// Type pour la route quote-detail
export type QuoteDetailRouteParams = {
    params: QuoteDetailParams;
};

// ============================================================================
// Fonctions utilitaires
// ============================================================================

/**
 * Parse un paramètre qui peut être un ID numérique ou une string
 */
export function parseNumericParam(value: string | number | undefined): number | undefined {
    if (value === undefined) return undefined;
    if (typeof value === 'number') return value;
    const num = Number(value);
    return isNaN(num) ? undefined : num;
}

/**
 * Parse un paramètre qui peut être JSON.stringified
 */
export function parseJsonParam<T>(value: string | undefined): T | undefined {
    if (!value) return undefined;
    try {
        return JSON.parse(value) as T;
    } catch {
        return undefined;
    }
}

/**
 * Vérifie si un paramètre est défini et non vide
 */
export function isParamDefined(value: string | number | undefined | null): boolean {
    return value !== undefined && value !== null && value !== '';
}
