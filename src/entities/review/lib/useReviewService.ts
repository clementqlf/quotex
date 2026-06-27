import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { httpClient } from '@/src/shared/api/HttpClient';
import { Review } from '@/src/shared/api/types';

/**
 * Hook pour récupérer les reviews d'un livre
 */
export const useReviewsByBookId = (bookId: number) => {
  return useQuery({
    queryKey: ['reviews', bookId],
    queryFn: () => httpClient.get<Review[]>(`/reviews?bookId=${bookId}`),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Hook pour créer une nouvelle review
 */
export const useCreateReview = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (review: { rating: number; comment?: string; bookId: number }) =>
      httpClient.post<Review>('/reviews', review),
    onSuccess: (_, { bookId }) => {
      queryClient.invalidateQueries({ queryKey: ['reviews', bookId] });
    },
  });
};

/**
 * Hook pour mettre à jour une review existante
 */
export const useUpdateReview = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewId, review }: { reviewId: number; review: { rating: number; comment?: string } }) =>
      httpClient.put<Review>(`/reviews/${reviewId}`, review),
    onSuccess: (_, { reviewId }) => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
    },
  });
};

/**
 * Hook pour supprimer une review
 */
export const useDeleteReview = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reviewId: number) =>
      httpClient.delete(`/reviews/${reviewId}`),
    onSuccess: (_, reviewId) => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
    },
  });
};
