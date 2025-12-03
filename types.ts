// Ce fichier centralise les types pour la navigation et les données

export type RootStackParamList = {
  Main: undefined;
  AuthorDetail: { authorName: string };
};

export interface Quote {
  id: number;
  text: string;
  book: string;
  author: string;
  date?: string;
  likes: number;
  isLiked: boolean;
}