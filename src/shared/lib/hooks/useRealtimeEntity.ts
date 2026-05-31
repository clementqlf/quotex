import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/src/shared/api/supabase';

/**
 * Options pour le hook useRealtimeEntity
 */
export interface RealtimeEntityOptions<T> {
  /** ID de l'entité à écouter */
  id: number | null | undefined;
  /** Valeur initiale de l'entité */
  initialData: T | null | undefined;
  /** Nom de la table Supabase */
  table: string;
  /** Champ à vérifier pour l'enrichissement (par défaut: 'isEnriching') */
  enrichingField?: string;
  /** Intervalle de polling en ms si Realtime échoue (par défaut: 2000) */
  pollingInterval?: number;
}

/**
 * Hook générique pour écouter les mises à jour d'une entité en temps réel
 * Utilise Supabase Realtime en priorité, avec fallback sur polling
 * 
 * @example
 * ```typescript
 * const book = useRealtimeEntity<Book>({
 *   id: bookId,
 *   initialData: initialBook,
 *   table: 'Book',
 *   enrichingField: 'isEnriching'
 * });
 * ```
 */
export function useRealtimeEntity<T>(options: RealtimeEntityOptions<T>): T | null | undefined {
  const { id, initialData, table, enrichingField = 'isEnriching', pollingInterval = 2000 } = options;
  const [data, setData] = useState<T | null | undefined>(initialData);
  const [useFallback, setUseFallback] = useState(false);
  const fallbackTriggeredRef = React.useRef(false);

  useEffect(() => {
    // 1. Synchroniser le state local avec les nouvelles props (initialData)
    // Cela permet d'afficher les corrections du serveur immédiatement (ex: majuscules)
    // même si l'entité est encore en cours d'enrichissement.
    setData((currentData) => {
      const currentIsEnriching = currentData && typeof currentData === 'object' && (currentData as any)[enrichingField];
      const initialIsEnriching = initialData && typeof initialData === 'object' && (initialData as any)[enrichingField];
      
      // On évite d'écraser des données fraîches (enrichissement terminé) par des props périmées
      const isStale = currentData && initialData && 
                      typeof currentData === 'object' && typeof initialData === 'object' &&
                      (currentData as any).id === (initialData as any).id && 
                      currentIsEnriching === false && 
                      initialIsEnriching === true;
                      
      return isStale ? currentData : initialData;
    });

    // 2. Décider si on doit souscrire aux mises à jour Realtime
    const isEnriching = initialData && typeof initialData === 'object' && 
      (initialData as any)[enrichingField];
    
    // Si pas d'ID ou pas d'enrichissement en cours, on s'arrête là (pas de Realtime)
    if (!id || !isEnriching) {
      return;
    }

    let channel: any = null;
    let interval: ReturnType<typeof setInterval> | null = null;

    const tryRealtime = async () => {
      try {
        console.log(`[Realtime] Subscribing to ${table} ${id}`);
        
        const uniqueId = Math.random().toString(36).substring(2, 9);
        channel = supabase
          .channel(`${table.toLowerCase()}_${id}_enrichment_${uniqueId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: table,
              filter: `id=eq.${id}`
            },
            (payload: any) => {
              console.log(`[Realtime] ${table} ${id} updated`, payload.new?.[enrichingField]);
              setData(payload.new);
              
              // Si l'enrichissement est terminé, on se désabonne
              if (payload.new?.[enrichingField] === false) {
                channel?.unsubscribe();
                console.log(`[Realtime] ${table} ${id} enrichment complete, unsubscribed`);
              }
            }
          )
          .subscribe((status: string, err?: Error) => {
            console.log(`[Realtime] ${table} ${id} channel status:`, status);
            
            // Seuls les erreurs réelles activent le fallback (une seule fois)
            // Status normaux: CHANNEL_OPENING, SUBSCRIBED, CLOSED (après unsubscribe)
            if (!fallbackTriggeredRef.current && (err || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT')) {
              fallbackTriggeredRef.current = true;
              console.log(`[Realtime] Error subscribing for ${table} ${id}:`, err?.message || status);
              console.log(`[Realtime] Using fallback polling for ${table} ${id}`);
              setUseFallback(true);
            }
          });

      } catch (err: any) {
        if (!fallbackTriggeredRef.current) {
          fallbackTriggeredRef.current = true;
          console.error(`[Realtime] ${table} ${id} realtime setup failed:`, err.message);
          setUseFallback(true);
        }
      }
    };

    const startPolling = () => {
      console.log(`[Polling] Starting fallback polling for ${table} ${id}`);
      interval = setInterval(async () => {
        try {
          const { data: fetchedData } = await supabase
            .from(table)
            .select('*')
            .eq('id', id)
            .single();
          
          if (fetchedData) {
            setData(fetchedData);
            if (fetchedData[enrichingField] === false) {
              if (interval) clearInterval(interval);
              console.log(`[Polling] ${table} ${id} enrichment complete, stopping polling`);
            }
          }
        } catch (err) {
          console.error(`[Polling] ${table} polling error:`, err);
        }
      }, pollingInterval);
    };

    // Essayer Realtime d'abord
    tryRealtime();

    // Si Realtime échoue, démarrer le polling
    if (useFallback) {
      startPolling();
    }

    return () => {
      console.log(`[Cleanup] Unsubscribing from ${table} ${id}`);
      channel?.unsubscribe();
      if (interval) clearInterval(interval);
      fallbackTriggeredRef.current = false; // Reset pour la prochaine fois
    };
  }, [id, initialData, table, enrichingField, pollingInterval, useFallback]);
  
  return data;
}

/**
 * Hook spécialisé pour les livres
 */
export function useBookRealtime(bookId: number | null | undefined, initialBook: any) {
  return useRealtimeEntity({
    id: bookId,
    initialData: initialBook,
    table: 'Book',
    enrichingField: 'isEnriching'
  });
}

/**
 * Hook spécialisé pour les auteurs
 */
export function useAuthorRealtime(authorId: number | null | undefined, initialAuthor: any) {
  return useRealtimeEntity({
    id: authorId,
    initialData: initialAuthor,
    table: 'Author',
    enrichingField: 'isEnriching'
  });
}

/**
 * Hook pour mettre à jour plusieurs livres en temps réel
 * Retourne un callback pour rafraîchir manuellement si nécessaire
 */
export function useRealtimeBooks(books: any[], refreshCallback?: () => void) {
  const enrichingBookIdsStr = useMemo(() => {
    return books
      .filter(b => b?.id && b?.isEnriching)
      .map(b => b.id)
      .sort()
      .join(',');
  }, [books]);

  // S'abonner à tous les livres en enrichissement
  useEffect(() => {
    if (!enrichingBookIdsStr) return;

    const ids = enrichingBookIdsStr.split(',').map(Number);
    console.log(`[Realtime] Subscribing to ${ids.length} enriching books`);

    const channels: any[] = [];

    ids.forEach(bookId => {
      const uniqueId = Math.random().toString(36).substring(2, 9);
      const channel = supabase
        .channel(`book_${bookId}_modal_${uniqueId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'Book',
            filter: `id=eq.${bookId}`
          },
          (payload: any) => {
            console.log(`[Realtime] Book ${bookId} updated in modal`, payload.new?.isEnriching);
            // Rafraîchir le callback parent si fourni
            refreshCallback?.();
          }
        )
        .subscribe();
      
      channels.push(channel);
    });

    return () => {
      console.log(`[Cleanup] Unsubscribing from ${channels.length} book channels`);
      channels.forEach(ch => ch.unsubscribe());
    };
  }, [enrichingBookIdsStr, refreshCallback]);
}

/**
 * Hook pour mettre à jour plusieurs auteurs en temps réel
 */
export function useRealtimeAuthors(authors: any[], refreshCallback?: () => void) {
  const enrichingAuthorIdsStr = useMemo(() => {
    return authors
      .filter(a => a?.id && a?.isEnriching)
      .map(a => a.id)
      .sort()
      .join(',');
  }, [authors]);

  useEffect(() => {
    if (!enrichingAuthorIdsStr) return;

    const ids = enrichingAuthorIdsStr.split(',').map(Number);
    console.log(`[Realtime] Subscribing to ${ids.length} enriching authors`);

    const channels: any[] = [];

    ids.forEach(authorId => {
      const uniqueId = Math.random().toString(36).substring(2, 9);
      const channel = supabase
        .channel(`author_${authorId}_modal_${uniqueId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'Author',
            filter: `id=eq.${authorId}`
          },
          (payload: any) => {
            console.log(`[Realtime] Author ${authorId} updated in modal`, payload.new?.isEnriching);
            refreshCallback?.();
          }
        )
        .subscribe();
      
      channels.push(channel);
    });

    return () => {
      console.log(`[Cleanup] Unsubscribing from ${channels.length} author channels`);
      channels.forEach(ch => ch.unsubscribe());
    };
  }, [enrichingAuthorIdsStr, refreshCallback]);
}
