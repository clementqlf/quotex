import { useCallback } from 'react';
import { useQuote } from '@/src/entities/quote/providers/QuoteProvider';
import { useAuthor } from '@/src/entities/author/providers/AuthorProvider';
import { PlatformServices } from '@/src/shared/platform';
import { Quote } from '@/src/shared/api/types';
import { quoteService } from '@/src/features/quote/api/QuoteService';
import { loadBookDetailData } from '@/src/entities/book/lib/loadBookDetailData';
import { API_BASE_URL } from '@/src/shared/config/api';
import { authService } from '@/src/entities/user/api/AuthService';

export interface HandleConfirmSaveOptions {
  onReset?: () => void;
  setShowModal?: (value: boolean) => void;
  editingQuote?: Quote | null;
  setEditingQuote?: (value: Quote | null) => void;
  isFromScanner?: boolean;
  // Injection de dépendance pour la navigation
  setTabIndex?: (index: number) => void;
}

export const useQuoteActions = () => {
  const { updateQuote, refreshQuotes } = useQuote();
  const { refreshBooks, refreshAuthors, getBookById, getBookByTitle, getBookByInventaireUri, importBook, getAuthorByName } = useAuthor();

  /**
   * Gère la confirmation d'ajout/modification d'une citation
   * Utilisé à la fois par le scanner (ScanWorkflow) et l'ajout manuel (MyQuotesScreen)
   * Utilise maintenant QuoteUseCases pour créer les citations
   */
  const handleConfirmSave = useCallback(
    async (
      text: string,
      book: string,
      author: string,
      options: HandleConfirmSaveOptions = {}
    ) => {
      console.log('[useQuoteActions] handleConfirmSave called');
      console.log('[useQuoteActions] text:', text);
      console.log('[useQuoteActions] book:', book);
      console.log('[useQuoteActions] author:', author);

      try {
        let newQuote: Quote | null = null;
        
        if (options.editingQuote) {
          console.log('[useQuoteActions] Updating existing quote');
          await updateQuote(options.editingQuote.id, {
            text,
            book: book || options.editingQuote.book,
            author: author || options.editingQuote.author
          });
        } else {
          console.log('[useQuoteActions] Adding new quote via QuoteUseCases');
          // Utiliser QuoteUseCases pour créer la citation avec matching et synchronisation
          newQuote = await quoteService.createQuoteWithMatching(text, book, author);
        }

        console.log('[useQuoteActions] Quote saved/updated successfully');

        // Feedback haptique
        await PlatformServices.haptics.notificationAsync('success');

        // Actions post-sauvegarde
        if (options.isFromScanner) {
          options.setTabIndex?.(0);
          options.onReset?.();
        }

        // Toujours rafraîchir les quotes, livres et auteurs
        await Promise.all([
          refreshQuotes(),
          refreshBooks(),
          refreshAuthors()
        ]);
        
        // Enrich the book in the background if it lacks metadata
        if (book && !options.editingQuote) {
          // Fire and forget enrichment
          loadBookDetailData({
            bookTitle: book,
            getBookById,
            getBookByTitle,
            getBookByInventaireUri,
            importBook,
            getAuthorByName
          }).then(() => {
            // Refresh again after enrichment completes to update the UI
            refreshBooks();
          }).catch(err => {
            console.error('[useQuoteActions] Background book enrichment failed:', err);
          });
        }

        // Enrich the author in the background if it lacks metadata
        if (newQuote?.author && typeof newQuote.author === 'object' && newQuote.author.id) {
          const authorObj = newQuote.author as any;
          if (authorObj.inventaireUri && (!authorObj.description || authorObj.description.length < 50)) {
            console.log('[useQuoteActions] Background enriching author:', authorObj.id);
            const token = await authService.getToken();
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            fetch(`${API_BASE_URL}/authors/${authorObj.id}/enrich`, { method: 'POST', headers })
              .then(() => refreshAuthors())
              .catch(err => console.error('[useQuoteActions] Background author enrichment failed:', err));
          }
        }

      } catch (error) {
        console.error('[useQuoteActions] Error saving quote:', error);
        throw error; // Permet au composant parent de gérer l'erreur si besoin
      } finally {
        options.setShowModal?.(false);
        options.setEditingQuote?.(null);
      }
    },
    [updateQuote, refreshQuotes, refreshBooks, refreshAuthors, getBookById, getBookByTitle, getBookByInventaireUri, importBook, getAuthorByName]
  );

  return { handleConfirmSave };
};
