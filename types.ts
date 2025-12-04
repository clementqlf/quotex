export interface Quote {
  id: number;
  text: string;
  book: string;
  author: string;
  date: string;
  likes: number;
  isLiked: boolean;
}

export interface User {
  id: string;
  name: string;
  username: string;
}

export interface SocialQuote {
  id: number;
  user: User;
  text: string;
  book: string;
  author: string;
  time: string;
  likes: number;
  comments: number;
  isLiked: boolean;
  isSaved: boolean;
}

// Type unifié pour les détails de citation, gérant les deux cas
export type AnyQuote = Omit<Quote, 'date'> & Partial<Pick<Quote, 'date'>> & Omit<SocialQuote, 'time'> & Partial<Pick<SocialQuote, 'time'>>;


export type RootStackParamList = {
  Main: undefined;
  QuoteDetail: { quote: AnyQuote; onToggleLike?: (id: number) => void };
  BookDetail: { bookTitle: string };
  AuthorDetail: { authorName: string };
  UserProfile: { user: User };
};