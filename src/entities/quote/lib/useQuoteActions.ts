import { useCallback } from 'react';
import { useQuote } from '@/src/entities/quote/providers/QuoteProvider';
import { useAuthor } from '@/src/entities/author/providers/AuthorProvider';
import { useTabIndex } from '@/src/app/providers/TabContext';
import { PlatformServices } from '@/src/shared/platform';
import { Quote } from '@/src/shared/api/types';
import { loadBookDetailData } from '@/src/entities/book/lib/loadBookDetailData';

export interface HandleConfirmSaveOptions {
  onReset?: () => void;
  setShowModal?: (value: boolean) => void;
  editingQuote?: Quote | null;
  setEditingQuote?: (value: Quote | null) => void;
  isFromScanner?: boolean;
}

export const useQuoteActions = () => {
  const { addQuote, updateQuote, refreshQuotes } = useQuote();
  const { refreshBooks, refreshAuthors, getBookById, getBookByTitle, getBookByInventaireUri, importBook, getAuthorByName } = useAuthor();
  const { setTabIndex } = useTabIndex();

  /**
   * Gère la confirmation d'ajout/modification d'une citation
   * Utilisé à la fois par le scanner (ScanWorkflow) et l'ajout manuel (MyQuotesScreen)
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
        if (options.editingQuote) {
          console.log('[useQuoteActions] Updating existing quote');
          await updateQuote(options.editingQuote.id, {
            text,
            book: book || options.editingQuote.book,
            author: author || options.editingQuote.author
          });
        } else {
          console.log('[useQuoteActions] Adding new quote');
          await addQuote(text, book, author);
        }

        console.log('[useQuoteActions] Quote saved/updated successfully');

        // Feedback haptique
        await PlatformServices.haptics.notificationAsync('success');

        // Actions post-sauvegarde
        if (options.isFromScanner) {
          setTabIndex(0);
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

      } catch (error) {
        console.error('[useQuoteActions] Error saving quote:', error);
        throw error; // Permet au composant parent de gérer l'erreur si besoin
      } finally {
        options.setShowModal?.(false);
        options.setEditingQuote?.(null);
      }
    },
    [addQuote, updateQuote, refreshQuotes, refreshBooks, refreshAuthors, getBookById, getBookByTitle, getBookByInventaireUri, importBook, getAuthorByName, setTabIndex]
  );

  return { handleConfirmSave };
};
