import { NavigatorScreenParams } from '@react-navigation/native';

// Define shared types here to avoid circular imports
export type User = {
  id: string | number;
  name: string;
  username: string;
  image?: string;
  bio?: string;
  website?: string;
  followers?: number;
  following?: number;
};

export type Author = {
  id?: number; // ensured number
  name: string;
  description: string;
  image: string;
  birthDate: string;
  nationality: string;
  similarAuthors?: Author[];
  openLibraryId?: string;
  isSaved?: boolean;
  quotesCount?: number;
};

export type Book = {
  id?: number; // ensured number
  title: string;
  description: string;
  year: number;
  pages: number;
  author: string | Author; // Author can also be an object now
  rating: number;
  genre: string;
  cover: string;
  buyLinks?: Array<{ store: string; url: string; price: string }>;
  similarBooks?: Book[];
  isSaved?: boolean;
  inventaireUri?: string;
  openLibraryId?: string;
  googleId?: string;
};

export type Quote = {
  id: number;
  text: string;
  book: string | Book; // Can be object (from server) or string (legacy/static)
  author: string | Author; // Can be object (from server) or string (legacy/static)
  theme?: string;
  date?: string;
  likesCount: number; // Replaced 'likes' number with likesCount
  likes?: any[]; // The relation array
  isLiked: boolean;
  user?: User;
  comments?: number;
  isSaved?: boolean;
  time?: string; // keeping for compatibility with globalQuotesDB if needed, or unify to date
  notes?: string;
  blockData?: Record<string, any>;
  aiInterpretation?: string;
  definitions?: Array<{ term: string; genre: string; definition: string; example: string }>;
};

export type Review = {
  id: number;
  rating: number;
  comment?: string | null;
  createdAt: string;
  user: User;
  userId: number;
  bookId: number;
};

// Define TabParamList here to avoid circular dependency
export type TabParamList = {
  MyQuotes: undefined;
  Scan: undefined;
  Social: undefined;
  Search: undefined; // Added Search route
};

export type RootStackParamList = {
  Main: NavigatorScreenParams<TabParamList>;
  AuthorDetail: { author?: Author; authorName?: string };
  BookDetail: { book?: Book; bookTitle?: string };
  QuoteDetail: { quoteId?: number; quote?: Quote };
  UserProfile: { user: User };
  ThemeDetail: { themeName: string };
  Search: undefined;
};

export type BlockType = 'definition' | 'notes' | 'bookInfo' | 'author' | 'similarBooks' | 'similarAuthors' | 'savedQuotes' | 'reviews' | 'buy';

export interface BlockConfig {
  id: string;
  type: BlockType;
}