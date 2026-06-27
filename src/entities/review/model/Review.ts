/**
 * Domain Object: Review
 * Représente un avis sur un livre dans le domaine métier
 */

import { User } from '@/src/entities/user/model/User';
import { Book } from '@/src/entities/book/model/Book';

export interface Review {
  id: number;
  rating: number;
  comment?: string | null;
  createdAt: string;
  user: User;
  userId: string;
  bookId: number;
  book?: Book;
}
