import { OperationQueue, PendingOperation } from '../OperationQueue';
import { StorageService, STORAGE_KEYS } from '@/src/shared/api/StorageService';

jest.mock('@/src/shared/api/StorageService', () => ({
  StorageService: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
  STORAGE_KEYS: {
    PENDING_OPERATIONS: 'pending_operations',
  },
}));

describe('OperationQueue', () => {
  let queue: OperationQueue;

  beforeEach(() => {
    jest.clearAllMocks();
    (OperationQueue as any).instance = null;
    queue = OperationQueue.getInstance();
    
    // Configurer le comportement par défaut de StorageService
    (StorageService.getItem as jest.Mock).mockResolvedValue([]);
    (StorageService.setItem as jest.Mock).mockResolvedValue(undefined);
    (StorageService.removeItem as jest.Mock).mockResolvedValue(undefined);
  });

  it('devrait suivre le pattern Singleton', () => {
    const instance1 = OperationQueue.getInstance();
    const instance2 = OperationQueue.getInstance();
    expect(instance1).toBe(instance2);
  });

  describe('enqueue', () => {
    it('devrait ajouter une opération standard avec des valeurs par défaut', async () => {
      await queue.enqueue({
        type: 'SAVE',
        entityType: 'quote',
        entityId: 1
      });

      expect(StorageService.getItem).toHaveBeenCalledWith(STORAGE_KEYS.PENDING_OPERATIONS);
      expect(StorageService.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.PENDING_OPERATIONS,
        expect.arrayContaining([
          expect.objectContaining({
            type: 'SAVE',
            entityType: 'quote',
            entityId: 1,
            retryCount: 0,
            maxRetries: 10,
            id: expect.any(String),
            createdAt: expect.any(String)
          })
        ])
      );
    });

    it('devrait dédupliquer (annuler mutuellement) les opérations inverses', async () => {
      const existingOp: PendingOperation = {
        id: '123',
        type: 'LIKE',
        entityType: 'quote',
        entityId: 1,
        createdAt: new Date().toISOString(),
        retryCount: 0,
        maxRetries: 10
      };
      
      (StorageService.getItem as jest.Mock).mockResolvedValue([existingOp]);

      // Ajout d'une opération inverse
      await queue.enqueue({
        type: 'UNLIKE',
        entityType: 'quote',
        entityId: 1
      });

      // Il devrait sauvegarder un tableau vide car l'opération existante est supprimée et la nouvelle n'est pas ajoutée
      expect(StorageService.setItem).toHaveBeenCalledWith(STORAGE_KEYS.PENDING_OPERATIONS, []);
    });
    
    it('devrait dédupliquer SAVE puis UNSAVE', async () => {
      const existingOp: PendingOperation = {
        id: '123',
        type: 'SAVE',
        entityType: 'book',
        entityId: 42,
        createdAt: new Date().toISOString(),
        retryCount: 0,
        maxRetries: 10
      };
      
      (StorageService.getItem as jest.Mock).mockResolvedValue([existingOp]);

      // Ajout d'une opération inverse
      await queue.enqueue({
        type: 'UNSAVE',
        entityType: 'book',
        entityId: 42
      });

      expect(StorageService.setItem).toHaveBeenCalledWith(STORAGE_KEYS.PENDING_OPERATIONS, []);
    });
  });

  describe('flush', () => {
    it('devrait exécuter les opérations avec succès et vider la queue', async () => {
      const ops: PendingOperation[] = [
        { id: '1', type: 'LIKE', entityType: 'quote', entityId: 1, retryCount: 0, maxRetries: 10, createdAt: '' },
        { id: '2', type: 'SAVE', entityType: 'book', entityId: 2, retryCount: 0, maxRetries: 10, createdAt: '' }
      ];
      
      (StorageService.getItem as jest.Mock).mockResolvedValue(ops);

      const executor = jest.fn().mockResolvedValue(undefined);
      
      const result = await queue.flush(executor);

      expect(result).toEqual({ succeeded: 2, failed: 0, remaining: 0 });
      expect(executor).toHaveBeenCalledTimes(2);
      expect(executor).toHaveBeenNthCalledWith(1, ops[0]);
      expect(executor).toHaveBeenNthCalledWith(2, ops[1]);
      
      // La file est vidée si tout réussit
      expect(StorageService.removeItem).toHaveBeenCalledWith(STORAGE_KEYS.PENDING_OPERATIONS);
    });

    it('devrait gérer l\'échec partiel (sauvegarde et incrément des retries)', async () => {
      const ops: PendingOperation[] = [
        { id: '1', type: 'LIKE', entityType: 'quote', entityId: 1, retryCount: 0, maxRetries: 10, createdAt: '' },
      ];
      
      (StorageService.getItem as jest.Mock).mockResolvedValue(ops);

      const error = new Error('Network timeout');
      const executor = jest.fn().mockRejectedValue(error);
      
      const result = await queue.flush(executor);

      expect(result).toEqual({ succeeded: 0, failed: 1, remaining: 1 });
      
      // L'opération échouée est sauvegardée avec un retryCount incrémenté et lastError
      expect(StorageService.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.PENDING_OPERATIONS,
        expect.arrayContaining([
          expect.objectContaining({
            id: '1',
            retryCount: 1,
            lastError: 'Network timeout'
          })
        ])
      );
    });

    it('devrait abandonner l\'opération si elle dépasse maxRetries', async () => {
      const ops: PendingOperation[] = [
        // Cette opération est déjà à son nombre maximum de retries (9) et va passer à 10 et être rejetée
        { id: '1', type: 'LIKE', entityType: 'quote', entityId: 1, retryCount: 9, maxRetries: 10, createdAt: '' },
      ];
      
      (StorageService.getItem as jest.Mock).mockResolvedValue(ops);

      const executor = jest.fn().mockRejectedValue(new Error('Persistent error'));
      
      const result = await queue.flush(executor);

      // Elle a échoué, mais elle ne reste pas dans la file (remaining: 0)
      expect(result).toEqual({ succeeded: 0, failed: 0, remaining: 0 });
      
      // La file est vidée car aucune opération restante n'est conservée
      expect(StorageService.removeItem).toHaveBeenCalledWith(STORAGE_KEYS.PENDING_OPERATIONS);
    });
  });

  describe('getBackoffDelay', () => {
    it('devrait calculer un délai exponentiel correct', () => {
      expect(queue.getBackoffDelay(0)).toBe(1000); // 1000 * 2^0
      expect(queue.getBackoffDelay(1)).toBe(2000); // 1000 * 2^1
      expect(queue.getBackoffDelay(2)).toBe(4000); // 1000 * 2^2
      expect(queue.getBackoffDelay(3)).toBe(8000); // 1000 * 2^3
    });

    it('devrait plafonner le délai à 60 secondes', () => {
      expect(queue.getBackoffDelay(6)).toBe(60000); // 1000 * 2^6 = 64000 -> plafonné à 60000
      expect(queue.getBackoffDelay(10)).toBe(60000);
    });
  });
});
