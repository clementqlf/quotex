import { Review } from '../../types';
import { API_BASE_URL } from '../config/api';

export const ReviewService = {
    async getReviewsByBookId(bookId: number): Promise<Review[]> {
        try {
            const response = await fetch(`${API_BASE_URL}/reviews?bookId=${bookId}`);
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Failed to fetch reviews. Status: ${response.status}, Body: ${errorText}`);
                throw new Error(`Failed to fetch reviews: ${response.status} ${errorText}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching reviews:', error);
            throw error;
        }
    },

    async createReview(review: { rating: number; comment?: string; bookId: number; userId: number }): Promise<Review | null> {
        try {
            const response = await fetch(`${API_BASE_URL}/reviews`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(review),
            });

            if (!response.ok) {
                throw new Error('Failed to create review');
            }
            return await response.json();
        } catch (error) {
            console.error('Error creating review:', error);
            return null;
        }
    }
};
