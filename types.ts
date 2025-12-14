import { NavigatorScreenParams } from '@react-navigation/native';
import { TabParamList } from './TabNavigator';

// Define shared types here to avoid circular imports
export type User = {
  id?: string;
  name: string;
  username: string;
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
};

export type RootStackParamList = {
  Main: NavigatorScreenParams<TabParamList>;
  AuthorDetail: { authorName: string };
  BookDetail: { bookTitle: string };
  QuoteDetail: { quoteId?: number; quote?: Quote };
  UserProfile: { user: User };
  ThemeDetail: { themeName: string };
};