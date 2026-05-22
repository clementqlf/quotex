import { useRouter } from 'expo-router';

export function useSmartNavigation() {
  const router = useRouter();

  /**
   * Navigate to a book detail screen.
   * Prefer inventaireUri or bookId (number) for canonical navigation — avoids duplicates in the stack.
   * Falls back to bookTitle (string) for cases where only the title is available (e.g. similar books blocks).
   */
  const navigateToBook = (bookIdOrTitle: number | string, inventaireUri?: string) => {
    let url = typeof bookIdOrTitle === 'number' 
      ? `/book-detail?bookId=${bookIdOrTitle}`
      : `/book-detail?bookTitle=${encodeURIComponent(bookIdOrTitle)}`;
      
    if (inventaireUri) {
      url += `&inventaireUri=${encodeURIComponent(inventaireUri)}`;
    }
    
    router.push(url as any);
  };

  /**
   * Navigate to an author detail screen.
   * Author names are @unique in the DB so using name as canonical param is safe.
   */
  const navigateToAuthor = (authorName: string, inventaireUri?: string) => {
    let url = `/author-detail?authorName=${encodeURIComponent(authorName)}`;
    if (inventaireUri) {
      url += `&inventaireUri=${encodeURIComponent(inventaireUri)}`;
    }
    router.push(url as any);
  };

  return { navigateToBook, navigateToAuthor };
}
