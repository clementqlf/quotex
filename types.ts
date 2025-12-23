import { NavigatorScreenParams } from '@react-navigation/native';
import { TabParamList } from './TabNavigator';

// Define shared types here to avoid circular imports
export type User = {
  id: string;
  name: string;
  username: string;
};

export type Author = {
  name: string;
  description: string;
  image: string;
  birthDate: string;
  nationality: string;
};

export type Book = {
  title: string;
  description: string;
  year: number;
  pages: number;
  author: string;
  rating: number;
  genre: string;
  cover: string;
};

export type Quote = {
  id: number;
  text: string;
  book: string;
  author: string;
  theme?: string;
  date?: string;
  likes: number;
  isLiked: boolean;
  user?: User;
  comments?: number;
  isSaved?: boolean;
  time?: string; // keeping for compatibility with globalQuotesDB if needed, or unify to date
  notes?: string;
  blockData?: Record<string, any>;
};

export type Review = {
  id: string;
  user: {
    name: string;
    image?: string;
  };
  rating: number;
  comment: string;
  date: string;
};

export type RootStackParamList = {
  Main: NavigatorScreenParams<TabParamList>;
  AuthorDetail: { author: Author };
  BookDetail: { book: Book };
  QuoteDetail: { quoteId?: number; quote?: Quote };
  UserProfile: { user: User };
  ThemeDetail: { themeName: string };
};

export type BlockType = 'definition' | 'notes' | 'bookInfo' | 'author' | 'similarBooks' | 'similarAuthors' | 'savedQuotes' | 'reviews';

export interface BlockConfig {
  id: string;
  type: BlockType;
}