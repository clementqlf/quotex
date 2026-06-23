import { logFetchError } from '@/src/shared/lib/offline/networkUtils';
import { httpClient } from './HttpClient';
import { Review } from './types';

export const ReviewService = {
    async getReviewsByBookId(bookId: number): Promise<Review[]> {
        try {
            return await httpClient.get<Review[]>(`/reviews?bookId=${bookId}`);
        } catch (error) {
            logFetchError('Error fetching reviews', error);
            throw error;
        }
    },

    async createReview(review: { rating: number; comment?: string; bookId: number }): Promise<Review | null> {
        try {
            return await httpClient.post<Review>('/reviews', review);
        } catch (error) {
            logFetchError('Error creating review', error);
            return null;
        }
    },

    async updateReview(reviewId: number, review: { rating: number; comment?: string }): Promise<Review | null> {
        try {
            return await httpClient.put<Review>(`/reviews/${reviewId}`, review);
        } catch (error) {
            logFetchError('Error updating review', error);
            return null;
        }
    },

    async deleteReview(reviewId: number): Promise<boolean> {
        try {
            await httpClient.delete(`/reviews/${reviewId}`);
            return true;
        } catch (error) {
            logFetchError('Error deleting review', error);
            return false;
        }
    }
};
