import { z } from 'zod';

/**
 * Network Resilience Utilities
 * 
 * Ce module fournit des outils pour améliorer la résilience des appels réseau :
 * - Circuit Breaker pour éviter les appels répétés sur des services en échec
 * - safeFetch pour des requêtes HTTP sécurisées avec timeout, retry et validation
 * - Monitoring structuré des erreurs externes
 */

// ============================================================================
// Configuration
// ============================================================================

export interface ResilienceConfig {
    timeoutMs?: number;
    maxRetries?: number;
    backoffMultiplier?: number;
    circuitBreaker?: {
        maxFailures: number;
        resetTimeout: number;
    };
}

// Configuration par défaut
const DEFAULT_CONFIG: Required<ResilienceConfig> = {
    timeoutMs: 10000,
    maxRetries: 3,
    backoffMultiplier: 1000,
    circuitBreaker: {
        maxFailures: 3,
        resetTimeout: 30000, // 30 secondes
    },
};

// ============================================================================
// Circuit Breaker
// ============================================================================

/**
 * Circuit Breaker Pattern
 * 
 * Empêche les appels répétés à un service qui est en échec.
 * Après un certain nombre d'échecs, le circuit s'ouvre et reste ouvert
 * pendant un délai avant de se réinitialiser.
 * 
 * @example
 * ```typescript
 * const wikidataBreaker = new CircuitBreaker({ maxFailures: 3, resetTimeout: 30000 });
 * const results = await wikidataBreaker.execute(() => fetchWikidata());
 * ```
 */
export class CircuitBreaker {
    private failures = 0;
    private readonly maxFailures: number;
    private readonly resetTimeout: number;
    private lastFailureTime: number | null = null;

    constructor(config: { maxFailures?: number; resetTimeout?: number } = {}) {
        this.maxFailures = config.maxFailures ?? DEFAULT_CONFIG.circuitBreaker.maxFailures;
        this.resetTimeout = config.resetTimeout ?? DEFAULT_CONFIG.circuitBreaker.resetTimeout;
    }

    /**
     * Vérifie si le circuit est ouvert (trop d'échecs récents)
     */
    private isOpen(): boolean {
        if (this.failures < this.maxFailures) return false;
        
        // Si on a atteint le nombre max d'échecs, vérifier si le délai de reset est passé
        if (this.lastFailureTime) {
            const timeSinceLastFailure = Date.now() - this.lastFailureTime;
            if (timeSinceLastFailure > this.resetTimeout) {
                // Réinitialiser le compteur après le délai
                this.failures = 0;
                return false;
            }
        }
        return true;
    }

    /**
     * Exécute une fonction avec protection Circuit Breaker
     */
    async execute<T>(fn: () => Promise<T>): Promise<T> {
        if (this.isOpen()) {
            throw new Error(`Circuit breaker open: service temporarily unavailable (${this.failures} failures)`);
        }

        try {
            const result = await fn();
            this.failures = 0; // Réinitialiser sur succès
            this.lastFailureTime = null;
            return result;
        } catch (error) {
            this.failures++;
            this.lastFailureTime = Date.now();
            throw error;
        }
    }

    /**
     * Réinitialise manuellement le circuit breaker
     */
    reset(): void {
        this.failures = 0;
        this.lastFailureTime = null;
    }

    /**
     * Retourne le nombre d'échecs actuels
     */
    getFailureCount(): number {
        return this.failures;
    }

    /**
     * Vérifie si le circuit est actuellement ouvert
     */
    isCircuitOpen(): boolean {
        return this.isOpen();
    }
}

// ============================================================================
// Safe Fetch with Retry and Validation
// ============================================================================

/**
 * Erreur personnalisée pour les timeouts
 */
export class TimeoutError extends Error {
    constructor(message: string = 'Request timed out') {
        super(message);
        this.name = 'TimeoutError';
    }
}

/**
 * Erreur personnalisée pour les échecs après tous les retries
 */
export class MaxRetriesError extends Error {
    constructor(message: string = 'Max retries exceeded') {
        super(message);
        this.name = 'MaxRetriesError';
    }
}

/**
 * Options pour safeFetch
 */
export interface SafeFetchOptions<T = any> extends Omit<RequestInit, 'signal'> {
    timeoutMs?: number;
    maxRetries?: number;
    backoffMultiplier?: number;
    retryableStatuses?: number[];
    retryableErrors?: string[];
    schema?: z.ZodSchema<T>;
    circuitBreaker?: CircuitBreaker;
    onRetry?: (attempt: number, error: any) => void;
    onError?: (error: any, context: { url: string; attempt: number }) => void;
}

/**
 * Résultat de safeFetch
 */
export interface SafeFetchResult<T> {
    data: T;
    ok: boolean;
    status: number;
    retries: number;
    fromCache?: boolean;
}

/**
 * Cache simple pour les requêtes GET
 */
const fetchCache = new Map<string, { data: any; timestamp: number; ttl: number }>();

/**
 * Exécute un fetch avec timeout
 */
function fetchWithTimeout(
    input: RequestInfo | URL,
    init: RequestInit & { timeoutMs: number }
): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), init.timeoutMs);

    // Supprimer timeoutMs des options car ce n'est pas une option standard
    const { timeoutMs, ...fetchOptions } = init;

    return fetch(input, {
        ...fetchOptions,
        signal: controller.signal,
    }).then((response) => {
        clearTimeout(timeoutId);
        return response;
    }).catch((error) => {
        clearTimeout(timeoutId);
        throw error;
    });
}

/**
 * Détecte si une erreur est réessayable
 */
function isRetryableError(error: any, retryableErrors: string[] = []): boolean {
    if (error?.name === 'AbortError' || error?.name === 'TimeoutError') return true;
    if (error?.message?.includes('network') || error?.message?.includes('fetch')) return true;
    if (retryableErrors.some(err => error?.message?.includes(err))) return true;
    return false;
}

/**
 * Détecte si un status HTTP est réessayable
 */
function isRetryableStatus(status: number, retryableStatuses: number[] = []): boolean {
    const defaultRetryable = [408, 429, 500, 502, 503, 504];
    return [...defaultRetryable, ...retryableStatuses].includes(status);
}

/**
 * Fonction safeFetch générique avec :
 * - Timeout configurable
 * - Retry avec backoff exponentiel
 * - Validation Zod optionnelle
 * - Circuit Breaker optionnel
 * - Cache optionnel pour les requêtes GET
 * 
 * @example
 * ```typescript
 * // Simple fetch with timeout
 * const data = await safeFetch('https://api.example.com/data', { timeoutMs: 5000 });
 * 
 * // Fetch with retry and validation
 * const user = await safeFetch('https://api.example.com/user', {
 *   timeoutMs: 8000,
 *   maxRetries: 3,
 *   schema: z.object({ name: z.string(), age: z.number() })
 * });
 * 
 * // Fetch with circuit breaker
 * const breaker = new CircuitBreaker();
 * const results = await safeFetch(url, { circuitBreaker });
 * ```
 */
export async function safeFetch<T = any>(
    input: RequestInfo | URL,
    options: SafeFetchOptions<T> = {}
): Promise<T> {
    const {
        timeoutMs = DEFAULT_CONFIG.timeoutMs,
        maxRetries = DEFAULT_CONFIG.maxRetries,
        backoffMultiplier = DEFAULT_CONFIG.backoffMultiplier,
        retryableStatuses = [],
        retryableErrors = [],
        schema,
        circuitBreaker,
        onRetry,
        onError,
        ...fetchOptions
    } = options;

    const url = typeof input === 'string' ? input : input.toString();
    let lastError: any = null;

    // Vérifier le circuit breaker si fourni
    if (circuitBreaker?.isCircuitOpen()) {
        throw new Error(`Service unavailable: ${url} (circuit breaker open)`);
    }

    // Vérifier le cache pour les requêtes GET
    if (fetchOptions.method !== 'POST' && fetchOptions.method !== 'PUT' && fetchOptions.method !== 'DELETE') {
        const cacheKey = `${url}:${JSON.stringify(fetchOptions.body)}`;
        const cached = fetchCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < cached.ttl) {
            return schema ? schema.parse(cached.data) : cached.data;
        }
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetchWithTimeout(input, {
                ...fetchOptions,
                timeoutMs,
            });

            if (!response.ok) {
                if (isRetryableStatus(response.status, retryableStatuses) && attempt < maxRetries) {
                    const delay = backoffMultiplier * attempt;
                    onRetry?.(attempt, new Error(`HTTP ${response.status}`));
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }

                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            // Valider avec Zod si un schéma est fourni
            if (schema) {
                const validated = schema.parse(data);
                
                // Mettre en cache pour les requêtes GET
                if (fetchOptions.method !== 'POST' && fetchOptions.method !== 'PUT') {
                    const cacheKey = `${url}:${JSON.stringify(fetchOptions.body)}`;
                    fetchCache.set(cacheKey, { data: validated, timestamp: Date.now(), ttl: 300000 }); // 5 min TTL
                }
                
                return validated;
            }

            // Mettre en cache pour les requêtes GET (sans validation)
            if (fetchOptions.method !== 'POST' && fetchOptions.method !== 'PUT') {
                const cacheKey = `${url}:${JSON.stringify(fetchOptions.body)}`;
                fetchCache.set(cacheKey, { data, timestamp: Date.now(), ttl: 300000 });
            }

            return data as T;

        } catch (error: any) {
            lastError = error;

            // Ne pas réessayer si c'est une erreur de validation Zod
            if (error?.name === 'ZodError') {
                onError?.(error, { url, attempt });
                throw error;
            }

            // Réessayer si l'erreur est réessayable
            if (attempt < maxRetries && isRetryableError(error, retryableErrors)) {
                const delay = backoffMultiplier * attempt;
                onRetry?.(attempt, error);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }

            // Si on arrive ici, c'est une erreur non réessayable ou on a atteint maxRetries
            onError?.(error, { url, attempt });
            
            if (circuitBreaker) {
                // Le circuit breaker va incrémenter son compteur
                // La prochaine tentative via execute() échouera si le seuil est atteint
            }
            
            if (attempt >= maxRetries) {
                throw new MaxRetriesError(`Max retries (${maxRetries}) exceeded for ${url}: ${error?.message}`);
            }
            throw error;
        }
    }

    // Ne devrait jamais arriver, mais pour satisfaire TypeScript
    throw lastError ?? new Error('Unexpected error in safeFetch');
}

// ============================================================================
// Monitoring des erreurs externes
// ============================================================================

/**
 * Niveaux de sévérité pour les erreurs
 */
export enum ErrorSeverity {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH',
    CRITICAL = 'CRITICAL',
}

/**
 * Type pour les métadonnées d'erreur
 */
export interface ExternalErrorMetadata {
    service: string;
    url?: string;
    method?: string;
    statusCode?: number;
    severity?: ErrorSeverity;
    userId?: string;
    timestamp: string;
    context?: Record<string, any>;
    retryCount?: number;
}

/**
 * Structure d'une erreur externalisée
 */
export interface TrackedExternalError {
    error: Error;
    metadata: ExternalErrorMetadata;
}

/**
 * Callback pour le monitoring personnalisé
 */
export type ErrorMonitorCallback = (error: TrackedExternalError) => void;

// Tableau des callbacks de monitoring
const errorMonitors: ErrorMonitorCallback[] = [];

/**
 * Ajoute un callback de monitoring personnalisé
 */
export function addErrorMonitor(callback: ErrorMonitorCallback): () => void {
    errorMonitors.push(callback);
    return () => {
        const index = errorMonitors.indexOf(callback);
        if (index > -1) errorMonitors.splice(index, 1);
    };
}

/**
 * Track une erreur externe avec métadonnées structurées
 * 
 * @example
 * ```typescript
 * try {
 *   await fetch('https://api.example.com/data');
 * } catch (error) {
 *   trackExternalError('MyAPI', error, { userId: '123', query: 'test' });
 * }
 * ```
 */
export function trackExternalError(
    service: string,
    error: any,
    context: Record<string, any> = {},
    severity: ErrorSeverity = ErrorSeverity.MEDIUM
): TrackedExternalError {
    const metadata: ExternalErrorMetadata = {
        service,
        url: context.url,
        method: context.method,
        statusCode: context.statusCode,
        severity,
        userId: context.userId,
        timestamp: new Date().toISOString(),
        context,
        retryCount: context.retryCount,
    };

    const trackedError: TrackedExternalError = {
        error: error instanceof Error ? error : new Error(String(error)),
        metadata,
    };

    // Logger structuré
    console.error(`[ExternalAPI:${service}]`, {
        error: trackedError.error.message,
        stack: trackedError.error.stack,
        metadata,
    });

    // Envoyer à tous les moniteurs enregistrés
    for (const monitor of errorMonitors) {
        try {
            monitor(trackedError);
        } catch (monitorError) {
            console.error('[ErrorMonitor] Callback failed:', monitorError);
        }
    }

    return trackedError;
}

/**
 * Crée un wrapper pour une API spécifique avec monitoring automatique
 */
export function createApiClient(
    serviceName: string,
    config: ResilienceConfig = {}
) {
    const circuitBreaker = new CircuitBreaker(config.circuitBreaker);
    const { timeoutMs, maxRetries, backoffMultiplier } = { ...DEFAULT_CONFIG, ...config };

    return {
        circuitBreaker,
        
        /**
         * Exécute une requête avec tracking automatique des erreurs
         */
        async request<T = any>(
            input: RequestInfo | URL,
            options: SafeFetchOptions<T> & { context?: Record<string, any> } = {}
        ): Promise<T> {
            try {
                return await safeFetch<T>(input, {
                    timeoutMs,
                    maxRetries,
                    backoffMultiplier,
                    circuitBreaker,
                    onError: (error, ctx) => {
                        trackExternalError(serviceName, error, {
                            ...ctx,
                            ...options.context,
                        });
                    },
                    ...options,
                });
            } catch (error: any) {
                trackExternalError(serviceName, error, {
                    url: typeof input === 'string' ? input : input.toString(),
                    method: options.method,
                });
                throw error;
            }
        },

        /**
         * Réinitialise le circuit breaker pour cette API
         */
        resetCircuitBreaker(): void {
            circuitBreaker.reset();
        },

        /**
         * Vérifie si le circuit est ouvert
         */
        isCircuitOpen(): boolean {
            return circuitBreaker.isCircuitOpen();
        },
    };
}

// ============================================================================
// Instances pré-configurées pour les services critiques
// ============================================================================

// Circuit Breakers pour chaque service critique
export const wikidataBreaker = new CircuitBreaker({ maxFailures: 3, resetTimeout: 60000 });
export const inventaireBreaker = new CircuitBreaker({ maxFailures: 5, resetTimeout: 30000 });
export const groqBreaker = new CircuitBreaker({ maxFailures: 3, resetTimeout: 60000 });
export const searchBreaker = new CircuitBreaker({ maxFailures: 3, resetTimeout: 30000 });

// Clients API pré-configurés
export const wikidataClient = createApiClient('Wikidata', { timeoutMs: 10000, maxRetries: 2 });
export const inventaireClient = createApiClient('Inventaire', { timeoutMs: 10000, maxRetries: 3 });
export const groqClient = createApiClient('Groq', { timeoutMs: 15000, maxRetries: 2 });
