import { NavigatorScreenParams } from '@react-navigation/native';
import { TabParamList } from './TabNavigator';
import { Quote } from './components/QuoteDetailModal';

export type User = {
  name: string;
  username: string;
};

export type RootStackParamList = {
  Main: NavigatorScreenParams<TabParamList>;
  AuthorDetail: { authorName: string };
  BookDetail: { bookTitle: string };
  QuoteDetail: { quoteId?: number; quote?: Quote };
  UserProfile: { user: User };
};