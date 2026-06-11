import React, { useState, useEffect, useMemo } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/src/shared/api/supabase';

// Type pour les payloads de changes Supabase
interface SupabaseRealtimePayload<T> {
  new: T | null;
  old: T | null;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
}

/**
 * Options pour le hook useRealtimeEntity
 */
export interface RealtimeEntityOptions<T extends Record<string, unknown>> {
  /** ID de l'entité à écouter */
  id: number | null | undefined;
  /** Valeur initiale de l'entité */
  initialData: T | null | undefined;
  /** Nom de la table Supabase */
  table: string;
  /** Champ à vérifier pour l'enrichissement (par défaut: 'isEnriching') */
  enrichingField?: keyof T;
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
export function useRealtimeEntity<T extends Record<string, unknown>>(
  options: RealtimeEntityOptions<T>
): T | null | undefined {
  const { id, initialData, table, enrichingField = 'isEnriching' as keyof T, pollingInterval = 2000 } = options;
  const [data, setData] = useState<T | null | undefined>(initialData);
  const [useFallback, setUseFallback] = useState(false);
  const fallbackTriggeredRef = React.useRef(false);

  useEffect(() => {
    // 1. Synchroniser le state local avec les nouvelles props (initialData)
    // Cela permet d'afficher les corrections du serveur immédiatement (ex: majuscules)
    // même si l'entité est encore en cours d'enrichissement.
    setData((currentData) => {
      const currentIsEnriching = currentData && typeof currentData === 'object' && currentData[enrichingField];
      const initialIsEnriching = initialData && typeof initialData === 'object' && initialData[enrichingField];
      
      // On évite d'écraser des données fraîches (enrichissement terminé) par des props périmées
      const isStale = currentData && initialData && 
                      typeof currentData === 'object' && typeof initialData === 'object' &&
                      currentData['id'] === initialData['id'] && 
                      currentIsEnriching === false && 
                      initialIsEnriching === true;
                      
      return isStale ? currentData : initialData;
    });

    // 2. Décider si on doit souscrire aux mises à jour Realtime
    const isEnriching = initialData && typeof initialData === 'object' && 
      initialData[enrichingField];
    
    // Si pas d'ID ou pas d'enrichissement en cours, on s'arrête là (pas de Realtime)
    if (!id || !isEnriching) {
      return;
    }

    let channel: RealtimeChannel | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;

    const tryRealtime = async () => {
      try {
        console.log(`[Realtime] Subscribing to ${table} ${id}`);
        
        const uniqueId = Math.random().toString(36).substring(2, 9);
        channel = supabase
          .channel(`${table.toLowerCase()}_${id}_enrichment_${uniqueId}`)
          .on(
            'postgres_changes' as any,
            {
              event: '*',
              schema: 'public',
              table: table,
              filter: `id=eq.${id}`
            },
            (payload: SupabaseRealtimePayload<T>) => {
              console.log(`[Realtime] ${table} ${id} updated`, payload.new?.[enrichingField as keyof T]);
              setData(payload.new);
              
              // Si l'enrichissement est terminé, on se désabonne
              if (payload.new?.[enrichingField as keyof T] === false) {
                if (channel) {
                  supabase.removeChannel(channel);
                }
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

      } catch (err: unknown) {
        if (!fallbackTriggeredRef.current) {
          fallbackTriggeredRef.current = true;
          console.error(`[Realtime] ${table} ${id} realtime setup failed:`, err instanceof Error ? err.message : String(err));
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
      if (channel) {
        supabase.removeChannel(channel);
      }
      if (interval) clearInterval(interval);
      fallbackTriggeredRef.current = false; // Reset pour la prochaine fois
    };
  }, [id, initialData, table, enrichingField, pollingInterval, useFallback]);
  
  return data;
}

import { Book } from '@/src/shared/api/types';
import { Author } from '@/src/shared/api/types';

/**
 * Hook spécialisé pour les livres
 */
export function useBookRealtime(bookId: number | null | undefined, initialBook: Book | null | undefined) {
  return useRealtimeEntity<Book & Record<string, unknown>>({
    id: bookId,
    initialData: initialBook as (Book & Record<string, unknown>) | null | undefined,
    table: 'Book',
    enrichingField: 'isEnriching'
  });
}

/**
 * Hook spécialisé pour les auteurs
 */
export function useAuthorRealtime(authorId: number | null | undefined, initialAuthor: Author | null | undefined) {
  return useRealtimeEntity<Author & Record<string, unknown>>({
    id: authorId,
    initialData: initialAuthor as (Author & Record<string, unknown>) | null | undefined,
    table: 'Author',
    enrichingField: 'isEnriching'
  });
}

/**
 * Hook pour mettre à jour plusieurs livres en temps réel
 * Version optimisée : un seul canal pour tous les livres avec filtre IN
 */
export function useRealtimeBooks(books: Book[], refreshCallback?: () => void) {
  const enrichingBookIds = useMemo(() => {
    return books
      .filter(b => b?.id && b?.isEnriching)
      .map(b => b.id as number)
      .sort((a, b) => a - b);
  }, [books]);

  // S'abonner à tous les livres en enrichissement avec UN SEUL canal
  useEffect(() => {
    if (!enrichingBookIds.length) return;

    console.log(`[Realtime] Subscribing to ${enrichingBookIds.length} enriching books with single channel`);

    const uniqueId = Math.random().toString(36).substring(2, 9);
    const channel = supabase
      .channel(`books_enrichment_batch_${uniqueId}`)
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'Book',
          filter: `id=in.(${enrichingBookIds.join(',')})`
        },
        (payload: SupabaseRealtimePayload<Book>) => {
          console.log(`[Realtime] Book ${payload.new?.id} updated in modal`, payload.new?.isEnriching);
          // Rafraîchir le callback parent si fourni
          refreshCallback?.();
        }
      )
      .subscribe();

    return () => {
      console.log(`[Cleanup] Unsubscribing from books batch channel`);
      supabase.removeChannel(channel);
    };
  }, [enrichingBookIds, refreshCallback]);
}

/**
 * Hook pour mettre à jour plusieurs auteurs en temps réel
 * Version optimisée : un seul canal pour tous les auteurs avec filtre IN
 */
export function useRealtimeAuthors(authors: Author[], refreshCallback?: () => void) {
  const enrichingAuthorIds = useMemo(() => {
    return authors
      .filter(a => a?.id && a?.isEnriching)
      .map(a => a.id as number)
      .sort((a, b) => a - b);
  }, [authors]);

  useEffect(() => {
    if (!enrichingAuthorIds.length) return;

    console.log(`[Realtime] Subscribing to ${enrichingAuthorIds.length} enriching authors with single channel`);

    const uniqueId = Math.random().toString(36).substring(2, 9);
    const channel = supabase
      .channel(`authors_enrichment_batch_${uniqueId}`)
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'Author',
          filter: `id=in.(${enrichingAuthorIds.join(',')})`
        },
        (payload: SupabaseRealtimePayload<Author>) => {
          console.log(`[Realtime] Author ${payload.new?.id} updated in modal`, payload.new?.isEnriching);
          refreshCallback?.();
        }
      )
      .subscribe();

    return () => {
      console.log(`[Cleanup] Unsubscribing from authors batch channel`);
      supabase.removeChannel(channel);
    };
  }, [enrichingAuthorIds, refreshCallback]);
}
