/**
 * Erreur lancée lorsqu'une opération ne peut pas être confirmée par le serveur
 * immédiatement (quote en attente de sync, 404 serveur, réseau indisponible)
 * et a été mise en file d'attente pour être rejouée plus tard.
 *
 * Permet aux appelants (ex: QuoteProvider) de distinguer:
 *   - Une vraie erreur → rollback de l'état optimiste
 *   - Une opération en attente → conserver l'état optimiste, ne pas refetch
 */
export class QueuedOperationError extends Error {
  readonly _isQueued = true as const;

  /**
   * @param result Le résultat optimiste à utiliser côté UI pendant l'attente.
   */
  constructor(public readonly result: { isSaved?: boolean; savedAt?: string | null; isLiked?: boolean; likesCount?: number }) {
    super('Operation queued for offline sync');
    this.name = 'QueuedOperationError';
  }

  /**
   * Type guard pour identifier cette erreur de façon sûre.
   */
  static is(err: unknown): err is QueuedOperationError {
    return err instanceof QueuedOperationError;
  }
}
