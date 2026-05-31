import { StorageService, STORAGE_KEYS } from '@/src/shared/api/StorageService';

export type OperationType = 'LIKE' | 'UNLIKE' | 'SAVE' | 'UNSAVE' | 'DELETE' | 'UPDATE' | 'CREATE';

export interface PendingOperation {
  id: string;                   // UUID unique de l'opération
  type: OperationType;
  entityType: 'quote' | 'book' | 'author';
  entityId: number;
  payload?: Record<string, any>;
  createdAt: string;
  retryCount: number;
  maxRetries: number;
  lastError?: string;
}

const STORAGE_KEY = STORAGE_KEYS.PENDING_OPERATIONS;
const MAX_RETRIES = 10;

export class OperationQueue {
  private static instance: OperationQueue;
  
  static getInstance(): OperationQueue {
    if (!OperationQueue.instance) {
      OperationQueue.instance = new OperationQueue();
    }
    return OperationQueue.instance;
  }

  /** Ajoute une opération à la queue */
  async enqueue(op: Omit<PendingOperation, 'id' | 'createdAt' | 'retryCount' | 'maxRetries'>): Promise<void> {
    const pending = await this.getAll();
    
    // Déduplication : si une op inverse existe, les annuler mutuellement
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

  /** Rejoue toutes les opérations en attente (FIFO) */
  async flush(executor: (op: PendingOperation) => Promise<void>): Promise<{
    succeeded: number;
    failed: number;
    remaining: number;
  }> {
    const pending = await this.getAll();
    if (pending.length === 0) return { succeeded: 0, failed: 0, remaining: 0 };

    let succeeded = 0;
    const remaining: PendingOperation[] = [];

    for (const op of pending) {
      try {
        await executor(op);
        succeeded++;
      } catch (error: any) {
        op.retryCount++;
        op.lastError = error.message;
        
        if (op.retryCount < op.maxRetries) {
          remaining.push(op);
        } else {
          console.error(`[OperationQueue] Dropping operation after ${op.maxRetries} retries:`, op);
        }
      }
    }

    if (remaining.length > 0) {
      await StorageService.setItem(STORAGE_KEY, remaining);
    } else {
      await StorageService.removeItem(STORAGE_KEY);
    }
    
    return { succeeded, failed: remaining.length, remaining: remaining.length };
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

  async getAll(): Promise<PendingOperation[]> {
    return await StorageService.getItem<PendingOperation[]>(STORAGE_KEY) || [];
  }
}
