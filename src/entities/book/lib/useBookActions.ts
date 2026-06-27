import { ReadingStatus } from '@/src/entities/author/model/Author';
import { buildBookImportPayload } from '@/src/entities/book/lib/bookImport';
import { getAuthorName, getBookTitle, isUserQuote, STATUS_OPTIONS } from '@/src/shared/lib/dataHelpers';
import { useSmartNavigation } from '@/src/shared/lib/hooks/useSmartNavigation';
import { useAuthor } from '@/src/entities/author/providers/AuthorProvider';
import { Book, Quote } from '@/src/shared/api/types';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ActionSheetIOS, Alert, Platform, Share } from 'react-native';
import { useAuth } from '@/src/app/providers/AuthContext';
import { Dispatch, SetStateAction, useCallback } from 'react';

/**
 * Hook pour les actions liées aux livres.
 * Retourne des fonctions pures qui prennent les données nécessaires en paramètre.
 */
export const useBookActions = () => {
  const { user: currentUser } = useAuth();
  const { navigateToBook, navigateToAuthor } = useSmartNavigation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toggleSaveBook, updateBookStatus, importBook } = useAuthor();

  /**
   * Calcule si un livre est sauvegardé par l'utilisateur
   */
  const computeIsSaved = useCallback((
    bookInfo: Book | null,
    userQuotesCountForThisBook: number
  ): boolean => {
    return (bookInfo?.isSaved || userQuotesCountForThisBook > 0);
  }, []);

  /**
   * Calcule si l'utilisateur peut désenregistrer le livre (pas de quotes associées)
   */
  const computeCanToggleSave = useCallback((
    userQuotesCountForThisBook: number
  ): boolean => {
    return userQuotesCountForThisBook === 0;
  }, []);

  /**
   * Ouvre le menu de statut pour un livre par ID
   */
  const handleOpenStatusMenuWithId = useCallback((
    id: number,
    bookInfo: Book | null,
    setBookInfo: Dispatch<SetStateAction<Book | null>>,
    userQuotesCountForThisBook: number
  ) => {
    const options = [...STATUS_OPTIONS];
    const isSaved = computeIsSaved(bookInfo, userQuotesCountForThisBook);
    const canUnsave = computeCanToggleSave(userQuotesCountForThisBook);

    const changeStatusOptimistic = async (status: ReadingStatus) => {
      const prevBookInfo = bookInfo;
      setBookInfo((prev: Book | null) => prev ? { ...prev, readingStatus: status, isSaved: true } : null);
      try {
        await updateBookStatus(id, status);
      } catch {
        setBookInfo(prevBookInfo);
        Alert.alert('Erreur', 'Impossible de mettre à jour le statut du livre.');
      }
    };

    const unsaveBookOptimistic = async () => {
      const prevBookInfo = bookInfo;
      setBookInfo((prev: Book | null) => prev ? { ...prev, isSaved: false, readingStatus: null } : null);
      try {
        await toggleSaveBook(id);
      } catch {
        setBookInfo(prevBookInfo);
        Alert.alert('Erreur', 'Impossible de retirer le livre de la bibliothèque.');
      }
    };

    if (Platform.OS === 'ios') {
      const iosOptions = ['Annuler', ...options.map(o => o.label)];
      if (isSaved && canUnsave) {
        iosOptions.push('Retirer de ma bibliothèque');
      }

      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: iosOptions,
          cancelButtonIndex: 0,
          destructiveButtonIndex: (isSaved && canUnsave) ? iosOptions.length - 1 : undefined,
          title: 'Classer ce livre',
        },
        async (buttonIndex) => {
          if (buttonIndex > 0) {
            if (isSaved && canUnsave && buttonIndex === iosOptions.length - 1) {
              await unsaveBookOptimistic();
            } else {
              const selected = options[buttonIndex - 1];
              await changeStatusOptimistic(selected.value as ReadingStatus);
            }
          }
        }
      );
      return;
    }

    const androidButtons: { text: string; style?: 'cancel' | 'destructive'; onPress: () => void }[] = [
      { text: 'Annuler', style: 'cancel', onPress: () => {} },
      ...STATUS_OPTIONS.map((o: { label: string; value: string; color: string }) => ({
        text: o.label,
        onPress: () => changeStatusOptimistic(o.value as ReadingStatus)
      }))
    ];

    if (isSaved && canUnsave) {
      androidButtons.push({
        text: 'Retirer de ma bibliothèque',
        style: 'destructive',
        onPress: unsaveBookOptimistic
      });
    }

    Alert.alert('Classer ce livre', 'Choisissez une catégorie', androidButtons);
  }, [computeIsSaved, computeCanToggleSave, updateBookStatus, toggleSaveBook]);

  /**
   * Gère l'appui sur le bouton de sauvegarde dans le header
   */
  const handleHeaderSavePress = useCallback(async (
    bookInfo: Book | null,
    setBookInfo: Dispatch<SetStateAction<Book | null>>,
    setIsImporting: Dispatch<SetStateAction<boolean>>,
    bookTitle: string | undefined
  ) => {
    let currentBookInfo = bookInfo;
    if (!currentBookInfo) return;

    if (!currentBookInfo.id) {
      try {
        setIsImporting(true);
        const importPayload = buildBookImportPayload({
          title: currentBookInfo.title,
          cover: currentBookInfo.cover,
          book: currentBookInfo,
        });

        if (!importPayload) {
          Alert.alert('Erreur', 'Impossible de préparer l\'import du livre.');
          return;
        }

        const imported = await importBook(importPayload);
        if (imported?.id) {
          currentBookInfo = imported;
          setBookInfo(imported);
          queryClient.invalidateQueries({ queryKey: ['book-detail'] });
        } else {
          Alert.alert('Erreur', 'Impossible de créer le livre sur le serveur.');
          return;
        }
      } catch (err) {
        console.error('[BookDetail] Failed to import book before saving:', err);
        Alert.alert('Erreur', 'Une erreur est survenue lors de la création du livre.');
        return;
      } finally {
        setIsImporting(false);
      }
    }

    if (currentBookInfo?.id) {
      handleOpenStatusMenuWithId(currentBookInfo.id, bookInfo, setBookInfo, 0);
    }
  }, [handleOpenStatusMenuWithId, importBook, queryClient]);

  /**
   * Gère le partage du livre
   */
  const handleShare = useCallback(async (
    bookInfo: Book | null,
    bookTitle: string | undefined
  ) => {
    if (!bookInfo) return;
    try {
      const authorName = getAuthorName(bookInfo.author);
      await Share.share({ message: `Découvrez "${bookTitle}" de ${authorName} sur Quotex !` });
    } catch (error: unknown) {
      Alert.alert('Erreur', error instanceof Error ? error.message : String(error));
    }
  }, []);

  /**
   * Calcule le nombre de quotes de l'utilisateur pour ce livre
   */
  const computeUserQuotesCount = useCallback((
    quotes: Quote[],
    bookTitle: string | undefined,
    currentUserId: string | undefined
  ): number => {
    return quotes.filter(q => {
      return isUserQuote(q, currentUserId) && getBookTitle(q.book).toLowerCase() === bookTitle?.toLowerCase();
    }).length;
  }, []);

  return {
    currentUser,
    navigateToBook,
    navigateToAuthor,
    router,
    queryClient,
    computeIsSaved,
    computeCanToggleSave,
    computeUserQuotesCount,
    handleOpenStatusMenuWithId,
    handleHeaderSavePress,
    handleShare,
  };
};
