/**
 * Contrats d'API pour la communication avec les Edge Functions de Supabase.
 * Ces types garantissent que le client et le serveur partagent la même structure
 * de données, réduisant ainsi les erreurs de payload.
 */

import type { Quote } from '@/src/entities/quote/model/Quote';

// Types pour les opérations offline
export type OperationType = 'LIKE' | 'UNLIKE' | 'SAVE' | 'UNSAVE' | 'DELETE' | 'UPDATE' | 'CREATE';
export type EntityType = 'QUOTE' | 'BOOK' | 'AUTHOR';

// Payload typé pour chaque type d'opération
export type OperationPayload =
  | { type: 'LIKE'; quoteId: number }
  | { type: 'UNLIKE'; quoteId: number }
  | { type: 'SAVE'; quoteId: number }
  | { type: 'UNSAVE'; quoteId: number }
  | { type: 'DELETE'; entityId: number | string; entityType: EntityType }
  | { type: 'UPDATE'; entityId: number | string; entityType: EntityType; data: unknown }
  | { type: 'CREATE'; entityType: EntityType; data: unknown };

// Payload pour la fonction `sync-quotes`
export interface SyncQuotesPayload {
  offlineQuotes: {
    text: string;
    book?: string | null;
    author?: string | null;
    theme?: string;
    offlineId?: string; // Utilisé par le client pour réconcilier après succès
    date?: string;
  }[];
}

export interface SyncQuotesResponse {
  syncedCount: number;
  results: {
    success: boolean;
    quoteId?: number;
    offlineId?: string;
    error?: string;
  }[];
}

// Payload pour la fonction `books/import`
export interface BookImportPayload {
  title: string;
  author: string;
  isbn?: string;
  coverUrl?: string;
  publishedDate?: string;
}

// Type définissant le format d'une opération asynchrone stockée offline
export interface OfflineOperationContract {
  id: string; // UUID de l'opération
  type: OperationType;
  entityId: number | string;
  entityType: EntityType;
  payload: OperationPayload;
  createdAt: number;
  retryCount: number;
}
