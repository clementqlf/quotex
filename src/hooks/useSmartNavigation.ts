import { useRouter, useNavigation } from 'expo-router';

export function useSmartNavigation() {
  const router = useRouter();
  const navigation = useNavigation<any>();

  const navigateToBook = (title: string, bookObj?: any) => {
    if (!title) return;
    const routes = navigation.getState()?.routes || [];
    const targetTitle = String(title).toLowerCase().trim();
    
    // Check if it's already in the stack
    const existingRoute = routes.find((r: any) => {
      if (r.name !== 'book-detail') return false;
      let rTitle = r.params?.bookTitle || r.params?.title;
      if (!rTitle && r.params?.book) {
        try {
          const p = JSON.parse(r.params.book);
          rTitle = p.title;
        } catch { rTitle = r.params.book; }
      }
      return rTitle ? String(rTitle).toLowerCase().trim() === targetTitle : false;
    });

    if (existingRoute) {
      // It exists in the stack! Pop back to it.
      if (typeof navigation.popTo === 'function') {
        navigation.popTo('book-detail', { bookTitle: title });
      } else {
        // Fallback for older versions or if method is missing
        navigation.navigate({ key: existingRoute.key });
      }
    } else {
      // Not in the stack, push or navigate normally
      if (bookObj) {
        router.push({ pathname: '/book-detail', params: { book: JSON.stringify(bookObj) } });
      } else {
        router.navigate(`/book-detail?bookTitle=${encodeURIComponent(title)}`);
      }
    }
  };

  const navigateToAuthor = (name: string, authorObj?: any) => {
    if (!name) return;
    const routes = navigation.getState()?.routes || [];
    const targetName = String(name).toLowerCase().trim();
    
    // Check if it's already in the stack
    const existingRoute = routes.find((r: any) => {
      if (r.name !== 'author-detail') return false;
      let rName = r.params?.authorName || r.params?.name;
      if (!rName && r.params?.author) {
        try {
          const p = JSON.parse(r.params.author);
          rName = p.name;
        } catch { rName = r.params.author; }
      }
      return rName ? String(rName).toLowerCase().trim() === targetName : false;
    });

    if (existingRoute) {
      if (typeof navigation.popTo === 'function') {
        navigation.popTo('author-detail', { authorName: name });
      } else {
        navigation.navigate({ key: existingRoute.key });
      }
    } else {
      if (authorObj) {
        router.push({ pathname: '/author-detail', params: { author: JSON.stringify(authorObj), authorName: name } });
      } else {
        router.navigate(`/author-detail?authorName=${encodeURIComponent(name)}`);
      }
    }
  };

  return { navigateToBook, navigateToAuthor };
}
