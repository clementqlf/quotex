export interface Quote {
  id: string;
  text: string;
  bookTitle: string;
  authorName: string;
  bookId: string;
  authorId: string;
  pageNumber?: number;
  savedAt: Date;
  imageUrl?: string;
}

export interface SocialQuote extends Quote {
  userId: string;
  userName: string;
  userAvatar: string;
  likes: number;
  comments: number;
  isLiked: boolean;
  postedAt: Date;
}

export interface Book {
  id: string;
  title: string;
  authorName: string;
  authorId: string;
  coverUrl: string;
  description: string;
  publishedYear: number;
  genre: string;
}

export interface Author {
  id: string;
  name: string;
  bio: string;
  photoUrl: string;
  booksCount: number;
  nationality: string;
  latestBooks: Book[];
}

export interface User {
  id: string;
  name: string;
  username: string;
  avatar: string;
  bio: string;
  quotesCount: number;
  followersCount: number;
  followingCount: number;
  recentQuotes: Quote[];
}