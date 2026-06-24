import { API_BASE_URL } from '@/src/shared/config/api';
import { isNetworkError } from '@/src/shared/lib/offline/networkUtils';
import Constants from 'expo-constants';

/**
 * Interface pour les options de requêtes HTTP
 */
export interface RequestOptions extends RequestInit {
  requiresAuth?: boolean;
  params?: Record<string, string | number | boolean>;
  /**
   * If true, 404 responses will return null instead of throwing an error
   * Useful for GET requests where missing resource is a valid state
   */
  ignore404?: boolean;
}

/**
 * Client HTTP centralisé pour l'application Quotex.
 * Gère l'injection de tokens, les headers communs et la sérialisation JSON.
 */
export class HttpClient {
  private static instance: HttpClient;
  
  // Rétrocompatibilité avec l'API Supabase PostgREST (Edge Functions)
  private readonly anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || Constants.expoConfig?.extra?.supabaseAnonKey || '';

  private tokenProvider: () => Promise<string | null> = async () => {
    try {
      // Dynamic import to break compile-time FSD check and require cycle
      const { authService } = require('@/src/entities/user/api/AuthService');
      return await authService.getToken();
    } catch {
      return null;
    }
  };

  private constructor() {}

  public static getInstance(): HttpClient {
    if (!HttpClient.instance) {
      HttpClient.instance = new HttpClient();
    }
    return HttpClient.instance;
  }

  public setTokenProvider(provider: () => Promise<string | null>): void {
    this.tokenProvider = provider;
  }

  /**
   * Construit les headers par défaut, incluant le token JWT si requis
   */
  private async buildHeaders(options: RequestOptions): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};

    if (options.headers) {
      if (options.headers instanceof Headers) {
        options.headers.forEach((value, key) => {
          headers[key] = value;
        });
      } else if (Array.isArray(options.headers)) {
        options.headers.forEach(([key, value]) => {
          headers[key] = value;
        });
      } else {
        Object.entries(options.headers).forEach(([key, value]) => {
          headers[key] = value;
        });
      }
    }

    const hasHeader = (name: string) => {
      const lower = name.toLowerCase();
      return Object.keys(headers).some(k => k.toLowerCase() === lower);
    };

    const setHeader = (name: string, value: string) => {
      const lower = name.toLowerCase();
      const existingKey = Object.keys(headers).find(k => k.toLowerCase() === lower);
      if (existingKey) {
        headers[existingKey] = value;
      } else {
        headers[name] = value;
      }
    };

    if (!hasHeader('Content-Type')) {
      setHeader('Content-Type', 'application/json');
    }

    if (options.requiresAuth !== false) {
      try {
        const token = await this.tokenProvider();
        if (token) {
          setHeader('Authorization', `Bearer ${token}`);
        }
      } catch (error) {
        console.warn('[HttpClient] Failed to get auth token:', error);
      }
    }
    
    // Si la requête utilise l'API_BASE_URL (Supabase Edge Functions ou REST), 
    // l'anon key peut être nécessaire dans l'en-tête apikey
    if (!hasHeader('apikey') && this.anonKey) {
       setHeader('apikey', this.anonKey);
    }

    return headers;
  }

  /**
   * Construit l'URL avec les query params
   */
  private buildUrl(path: string, params?: Record<string, string | number | boolean>): string {
    const baseUrl = path.startsWith('http') ? path : `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
    if (!params) return baseUrl;

    // Fix pour React Native: utiliser notre propre constructeur si URL() n'est pas dispo
    let urlString = baseUrl;
    const query = Object.entries(params)
      .filter(([_, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
      
    if (query) {
      urlString += (urlString.includes('?') ? '&' : '?') + query;
    }
    
    return urlString;
  }

  /**
   * Méthode générique pour effectuer une requête
   */
  public async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = this.buildUrl(path, options.params);
    const headers = await this.buildHeaders(options);

    const fetchOptions: RequestInit = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, fetchOptions);

      // Si la réponse n'est pas OK, on lance une erreur avec le body si possible
      if (!response || !response.ok) {
        // Handle 404 gracefully if ignore404 is set
        if (response?.status === 404 && options.ignore404) {
          return null as unknown as T;
        }
        
        let errorMessage = response ? `HTTP Error ${response.status}: ${response.statusText}` : 'Network error or response undefined';
        if (response) {
          try {
            const errorBody = await response.text();
            if (errorBody) {
              errorMessage += ` - ${errorBody}`;
            }
          } catch {
            // Ignorer l'erreur de parsing
          }
        }
        throw new Error(errorMessage);
      }

      // Si c'est un 204 No Content, on retourne null
      if (response.status === 204) {
        return null as unknown as T;
      }

      // Parse JSON par défaut
      const contentType = response.headers?.get?.('content-type');
      if ((contentType && contentType.includes('application/json')) || (typeof response.json === 'function' && !contentType)) {
        return await response.json();
      }

      // Pour les réponses non-JSON, retourner le texte
      // Note: Ce cast est safe si le caller attend une string
      const text = await response.text();
      return text as unknown as T;
    } catch (error: unknown) {
      if (isNetworkError(error)) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`[HttpClient] Request failed due to network connectivity: ${options.method || 'GET'} ${url}`, errorMessage);
      } else {
        console.error(`[HttpClient] Request failed: ${options.method || 'GET'} ${url}`, error);
      }
      throw error;
    }
  }

  public async get<T>(path: string, options?: Omit<RequestOptions, 'method'>): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  /**
   * GET request that returns null on 404 instead of throwing an error.
   * Use this for fetching resources where "not found" is a valid, expected state.
   */
  public async getSafe<T>(path: string, options?: Omit<RequestOptions, 'method'>): Promise<T | null> {
    return this.request<T>(path, { ...options, method: 'GET', ignore404: true });
  }

  public async post<T, BodyType = unknown>(path: string, body: BodyType, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  }

  public async put<T, BodyType = unknown>(path: string, body: BodyType, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'PUT',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  }

  public async patch<T, BodyType = unknown>(path: string, body: BodyType, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'PATCH',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  }

  public async delete<T>(path: string, options?: Omit<RequestOptions, 'method'>): Promise<T> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }
}

export const httpClient = HttpClient.getInstance();
