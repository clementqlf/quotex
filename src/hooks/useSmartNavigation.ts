import { useRouter } from 'expo-router';

export function useSmartNavigation() {
  const router = useRouter();

  /**
   * Navigate to a book detail screen.
   * Prefer bookId (number) for canonical navigation — avoids duplicates in the stack.
   * Falls back to bookTitle (string) for cases where only the title is available (e.g. similar books blocks).
   */
  const navigateToBook = (bookIdOrTitle: number | string) => {
    if (typeof bookIdOrTitle === 'number') {
      router.navigate(`/book-detail?bookId=${bookIdOrTitle}`);
    } else {
      router.navigate(`/book-detail?bookTitle=${encodeURIComponent(bookIdOrTitle)}`);
    }
  };

  /**
   * Navigate to an author detail screen.
   * Author names are @unique in the DB so using name as canonical param is safe.
   */
  const navigateToAuthor = (authorName: string) => {
    router.navigate(`/author-detail?authorName=${encodeURIComponent(authorName)}`);
  };

  return { navigateToBook, navigateToAuthor };
}
