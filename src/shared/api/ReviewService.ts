import { Review } from './types';
import { API_BASE_URL } from '../config/api';
import { authService } from '../../entities/user/api/AuthService';
import { logFetchError } from '@/src/shared/lib/offline/networkUtils';

export const ReviewService = {
    async getReviewsByBookId(bookId: number): Promise<Review[]> {
        try {
            const token = await authService.getToken();
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch(`${API_BASE_URL}/reviews?bookId=${bookId}`, { headers });
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Failed to fetch reviews. Status: ${response.status}, Body: ${errorText}`);
                throw new Error(`Failed to fetch reviews: ${response.status} ${errorText}`);
            }
            return await response.json();
        } catch (error) {
            logFetchError('Error fetching reviews', error);
            throw error;
        }
    },

    async createReview(review: { rating: number; comment?: string; bookId: number }): Promise<Review | null> {
        try {
            const token = await authService.getToken();
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch(`${API_BASE_URL}/reviews`, {
                method: 'POST',
                headers,
                body: JSON.stringify(review),
            });

            if (!response.ok) {
                throw new Error('Failed to create review');
            }
            return await response.json();
        } catch (error) {
            logFetchError('Error creating review', error);
            return null;
        }
    },

    async updateReview(reviewId: number, review: { rating: number; comment?: string }): Promise<Review | null> {
        try {
            const token = await authService.getToken();
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch(`${API_BASE_URL}/reviews/${reviewId}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(review),
            });

            if (!response.ok) {
                throw new Error('Failed to update review');
            }
            return await response.json();
        } catch (error) {
            logFetchError('Error updating review', error);
            return null;
        }
    },

    async deleteReview(reviewId: number): Promise<boolean> {
        try {
            const token = await authService.getToken();
            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch(`${API_BASE_URL}/reviews/${reviewId}`, {
                method: 'DELETE',
                headers,
            });

            if (!response.ok) {
                throw new Error('Failed to delete review');
            }
            return true;
        } catch (error) {
            logFetchError('Error deleting review', error);
            return false;
        }
    }
};
