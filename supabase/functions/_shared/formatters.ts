// ─── Formatters (mirror of Express index.ts helpers) ─────────────────────────

export const formatBook = (book: any, userId: string | number = 0) => {
  if (!book) return null;
  let buyLinks = [];
  try {
    if (book.buyLinks && typeof book.buyLinks === 'string' && book.buyLinks.trim().length > 0) {
      buyLinks = JSON.parse(book.buyLinks);
    } else if (Array.isArray(book.buyLinks)) {
      buyLinks = book.buyLinks;
    }
  } catch {
    // ignore
  }

  const userLink = book.users?.find((u: any) => u.userId === userId);
  return {
    ...book,
    isSaved: !!userLink,
    readingStatus: userLink?.status || null,
    buyLinks,
  };
};

export const formatAuthor = (author: any, userId: string | number = 0) => {
  if (!author) return null;
  const userLink = author.users?.find((u: any) => u.userId === userId);
  return {
    ...author,
    isSaved: !!userLink,
    quotesCount: author._count?.quotes ?? author.quotesCount ?? 0,
  };
};

export const formatQuote = (quote: any, userId: string | number = 0) => {
  if (!quote) return null;
  const isSaved = quote.savedBy ? quote.savedBy.some((s: any) => s.userId === userId) : false;
  return {
    ...quote,
    book: quote.book ? formatBook(quote.book, userId) : null,
    isSaved,
    isLiked: quote.likes ? quote.likes.some((l: any) => l.userId === userId) : false,
    likesCount: quote._count?.likes ?? quote.likesCount ?? 0,
  };
};

// Generate buy links for a book
export function generateBuyLinks(isbn: string | null, title: string, authorName: string, googleBuyLink?: string | null) {
  const links: Array<{ store: string; url: string; price: string }> = [];

  if (googleBuyLink) {
    links.push({ store: 'Google Play', url: googleBuyLink, price: '' });
  }

  if (isbn) {
    links.push({ store: 'Amazon', url: `https://www.amazon.fr/s?k=${isbn}`, price: '' });
    links.push({ store: 'Fnac', url: `https://www.fnac.com/SearchResult/ResultList.aspx?Search=${isbn}`, price: '' });
    links.push({ store: 'Chasse-aux-livres', url: `https://www.chasse-aux-livres.fr/pr/${isbn}`, price: '' });
  } else {
    const q = encodeURIComponent(`${title} ${authorName}`.trim());
    links.push({ store: 'Amazon', url: `https://www.amazon.fr/s?k=${q}`, price: '' });
    links.push({ store: 'Fnac', url: `https://www.fnac.com/SearchResult/ResultList.aspx?Search=${q}`, price: '' });
  }
  return links;
}
