import { STORAGE_KEYS, StorageService } from '@/src/shared/api/StorageService';

export type OperationType = 'LIKE' | 'UNLIKE' | 'SAVE' | 'UNSAVE' | 'DELETE' | 'UPDATE' | 'CREATE';

export interface PendingOperation {
  id: string;                   // UUID unique de l'opération
  type: OperationType;
  entityType: 'quote' | 'book' | 'author';
  entityId: number;            // ID de l'entité (utilise number pour compatibilité)
  payload?: Record<string, any>;
  createdAt: string;
  retryCount: number;
  maxRetries: number;
  lastError?: string;
}

const STORAGE_KEY = STORAGE_KEYS.PENDING_OPERATIONS;
const MAX_RETRIES = 10;
const CONCURRENCY = 1; // Nombre max d'opérations simultanées (séquentiel pour éviter les conflits d'ID temporaires)

export class OperationQueue {
  private static instance: OperationQueue;
  private currentPending: PendingOperation[] | null = null;
  
  static getInstance(): OperationQueue {
    if (!OperationQueue.instance) {
      OperationQueue.instance = new OperationQueue();
    }
    return OperationQueue.instance;
  }

  /** Ajoute une opération à la queue */
  async enqueue(op: Omit<PendingOperation, 'id' | 'createdAt' | 'retryCount' | 'maxRetries'>): Promise<void> {
    const pending = await this.getAll();
    
    // 1. Déduplication des opérations identiques (même type, entityType, entityId)
    const existingIndex = pending.findIndex(p => 
      p.entityType === op.entityType && 
      p.entityId === op.entityId &&
      p.type === op.type
    );
    
    if (existingIndex !== -1) {
      // L'opération existe déjà, on ne la duplique pas
      console.log(`[OperationQueue] Operation ${op.type} for ${op.entityType}:${op.entityId} already in queue, skipping.`);
      return;
    }
    
    // 2. Déduplication : si une op inverse existe, les annuler mutuellement
    const inverseIndex = pending.findIndex(p => 
      p.entityType === op.entityType && 
      p.entityId === op.entityId &&
      this.isInverse(p.type, op.type)
    );
    
    if (inverseIndex !== -1) {
      // Annulation mutuelle (ex: LIKE puis UNLIKE = rien)
      pending.splice(inverseIndex, 1);
      await StorageService.setItem(STORAGE_KEY, pending);
      console.log(`[OperationQueue] Cancelled inverse operation for ${op.entityType}:${op.entityId}`);
      return;
    }

    const operation: PendingOperation = {
      ...op,
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      createdAt: new Date().toISOString(),
      retryCount: 0,
      maxRetries: MAX_RETRIES,
    };

    pending.push(operation);
    await StorageService.setItem(STORAGE_KEY, pending);
    console.log(`[OperationQueue] Enqueued ${op.type} for ${op.entityType}:${op.entityId}`);
  }

  /** Rejoue toutes les opérations en attente avec traitement parallèle et backoff exponentiel */
  async flush(executor: (op: PendingOperation) => Promise<void>): Promise<{
    succeeded: number;
    failed: number;
    remaining: number;
  }> {
    this.currentPending = await this.getAll();
    if (this.currentPending.length === 0) {
      this.currentPending = null;
      return { succeeded: 0, failed: 0, remaining: 0 };
    }

    let succeeded = 0;
    const failed: PendingOperation[] = [];
    const inProgress = new Set<string>();

    // Traiter en parallèle avec contrôle de concurrence
    const processNext = async () => {
      if (!this.currentPending || this.currentPending.length === 0) return;

      const op = this.currentPending.shift()!;
      inProgress.add(op.id);

      try {
        // Appliquer le délai de backoff exponentiel
        const backoffDelay = this.getBackoffDelay(op.retryCount);
        if (backoffDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }

        await executor(op);
        succeeded++;
      } catch (error: any) {
        op.retryCount++;
        op.lastError = error.message;
        
        if (op.retryCount < op.maxRetries) {
          failed.push(op);
        } else {
          console.error(`[OperationQueue] Dropping operation after ${op.maxRetries} retries:`, op);
        }
      } finally {
        inProgress.delete(op.id);
        await processNext();
      }
    };

    // Lancer les premières opérations
    const promises: Promise<void>[] = [];
    for (let i = 0; i < Math.min(CONCURRENCY, this.currentPending.length); i++) {
      promises.push(processNext());
    }

    await Promise.all(promises);
    this.currentPending = null;

    // Sauvegarder les échecs pour retry
    if (failed.length > 0) {
      const currentPending = await this.getAll();
      await StorageService.setItem(STORAGE_KEY, [...currentPending, ...failed]);
    } else {
      await StorageService.removeItem(STORAGE_KEY);
    }
    
    return {
      succeeded,
      failed: failed.length,
      remaining: failed.length
    };
  }

  /** Calculer le délai de backoff exponentiel */
  getBackoffDelay(retryCount: number): number {
    return Math.min(1000 * Math.pow(2, retryCount), 60000); // Max 1 minute
  }

  private isInverse(a: OperationType, b: OperationType): boolean {
    const inverses: Record<string, string> = {
      'LIKE': 'UNLIKE', 'UNLIKE': 'LIKE',
      'SAVE': 'UNSAVE', 'UNSAVE': 'SAVE',
    };
    return inverses[a] === b;
  }

  /** Met à jour l'entityId de toutes les opérations associées à une entité */
  async remapEntityId(oldId: number, newId: number, entityType: 'quote' | 'book' | 'author'): Promise<void> {
    // 1. Mettre à jour l'état en mémoire s'il y a un flush en cours
    if (this.currentPending) {
      this.currentPending = this.currentPending.map(p => {
        if (p.entityType === entityType && p.entityId === oldId) {
          return { ...p, entityId: newId };
        }
        return p;
      });
    }

    // 2. Mettre à jour dans le stockage persistant
    const pending = await this.getAll();
    let changed = false;
    const updated = pending.map(p => {
      if (p.entityType === entityType && p.entityId === oldId) {
        changed = true;
        return { ...p, entityId: newId };
      }
      return p;
    });
    
    if (changed) {
      await StorageService.setItem(STORAGE_KEY, updated);
      console.log(`[OperationQueue] Remapped ${entityType} ID from ${oldId} to ${newId} in ${updated.filter(p => p.entityId === newId).length} pending operations.`);
    }
  }

  async getAll(): Promise<PendingOperation[]> {
    return await StorageService.getItem<PendingOperation[]>(STORAGE_KEY) || [];
  }

  async clear(): Promise<void> {
    this.currentPending = null;
    await StorageService.removeItem(STORAGE_KEY);
    console.log('[OperationQueue] Queue cleared.');
  }
}
