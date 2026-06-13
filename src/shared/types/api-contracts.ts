/**
 * Contrats d'API pour la communication avec les Edge Functions de Supabase.
 * Ces types garantissent que le client et le serveur partagent la même structure
 * de données, réduisant ainsi les erreurs de payload.
 */

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
  type: 'LIKE' | 'UNLIKE' | 'SAVE' | 'UNSAVE' | 'DELETE' | 'UPDATE' | 'CREATE';
  entityId: number | string;
  entityType: 'QUOTE' | 'BOOK' | 'AUTHOR';
  payload?: any;
  createdAt: number;
  retryCount: number;
}
