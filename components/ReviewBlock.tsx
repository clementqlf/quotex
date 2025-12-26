import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, Image, StyleSheet, Modal, ScrollView, Alert } from 'react-native';
import { Star, User, Send, X } from 'lucide-react-native';
import { Review, User as UserType } from '../types';
import { ReviewService } from '../src/services/ReviewService';

interface ReviewBlockProps {
    bookId: number;
    onRemove?: () => void;
    onReviewAdded?: () => void;
}

export default function ReviewBlock({ bookId, onRemove, onReviewAdded }: ReviewBlockProps) {
    const [reviews, setReviews] = useState<Review[]>([]);
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [isAllReviewsVisible, setAllReviewsVisible] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        loadReviews();
    }, [bookId]);

    const loadReviews = async () => {
        setIsLoading(true);
        console.log(`[ReviewBlock] Fetching reviews for bookId: ${bookId}`);
        try {
            const fetchedReviews = await ReviewService.getReviewsByBookId(bookId);
            console.log(`[ReviewBlock] Fetched ${fetchedReviews.length} reviews`);
            setReviews(fetchedReviews);
        } catch (error) {
            console.error("[ReviewBlock] Error loading reviews:", error);
            Alert.alert("Erreur", "Impossible de charger les avis. Veuillez vérifier votre connexion.");
        } finally {
            setIsLoading(false);
        }
    };

    const handlePublishReview = async () => {
        if (rating === 0) {
            Alert.alert("Erreur", "Veuillez donner une note.");
            return;
        }

        // Optimistic update or wait for server? Let's wait for server for simplicity
        const newReview = await ReviewService.createReview({
            rating,
            comment,
            bookId,
            userId: 1 // Default user
        });

        if (newReview) {
            setReviews([newReview, ...reviews]);
            setRating(0);
            setComment('');
            Alert.alert("Succès", "Votre avis a été publié !");
            if (onRemove) {
                // Optionally remove the block if it was a one-time thing, but usually we want to keep it to show the review
            }
            if (onReviewAdded) {
                onReviewAdded();
            }
        } else {
            Alert.alert("Erreur", "Impossible de publier l'avis.");
        }
    };

    // Check if current user already posted a review? 
    // For now, allow multiple or just show form.

    const userReview = reviews.find(r => r.userId === 1);
    // If user reviewed, maybe show their review instead of form? 
    // For now, let's just show the form always if not simple to filter locally.
    // Or better: separate "My Review" input from "Community Reviews".

    return (
        <View style={styles.removableWrapper}>
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Star size={16} color="#20B8CD" />
                    <Text style={styles.sectionTitle}>Avis & Commentaires</Text>
                </View>

                {/* User Rating input */}
                <View style={styles.userRatingContainer}>
                    <Text style={styles.subTitle}>Votre note</Text>
                    <View style={styles.starRow}>
                        {[1, 2, 3, 4, 5].map((star) => (
                            <TouchableOpacity key={star} onPress={() => setRating(star)}>
                                <Star
                                    size={24}
                                    color={rating >= star ? "#20B8CD" : "#4B5563"}
                                    fill={rating >= star ? "#20B8CD" : "none"}
                                />
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* User Comment input */}
                <View style={styles.commentInputContainer}>
                    <TextInput
                        style={styles.commentInput}
                        placeholder="Donnez votre avis sur ce livre..."
                        placeholderTextColor="#6B7280"
                        multiline
                        value={comment}
                        onChangeText={setComment}
                    />
                    <TouchableOpacity style={styles.publishButton} onPress={handlePublishReview}>
                        <Send size={14} color="#000" />
                        <Text style={styles.publishButtonText}>Publier</Text>
                    </TouchableOpacity>
                </View>

                {/* Other reviews list */}
                {reviews.length > 0 && (
                    <View style={styles.reviewsList}>
                        <Text style={styles.subTitle}>Avis de la communauté</Text>
                        {reviews.slice(0, 2).map((review) => (
                            <View key={review.id} style={styles.reviewItem}>
                                <View style={styles.reviewHeader}>
                                    <View style={styles.reviewerInfo}>
                                        {review.user?.image ? (
                                            <Image source={{ uri: review.user.image }} style={styles.reviewerAvatar} />
                                        ) : (
                                            <View style={[styles.reviewerAvatar, { backgroundColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center' }]}>
                                                <User size={12} color="#9CA3AF" />
                                            </View>
                                        )}
                                        <Text style={styles.reviewerName}>{review.user.name || 'Utilisateur'}</Text>
                                    </View>
                                    <Text style={styles.reviewDate}>{new Date(review.createdAt).toLocaleDateString()}</Text>
                                </View>
                                <View style={styles.reviewRating}>
                                    {[1, 2, 3, 4, 5].map(s => (
                                        <Star key={s} size={10} color={review.rating >= s ? "#20B8CD" : "#4B5563"} fill={review.rating >= s ? "#20B8CD" : "none"} />
                                    ))}
                                </View>
                                {review.comment && <Text style={styles.reviewComment}>{review.comment}</Text>}
                            </View>
                        ))}
                        {reviews.length > 2 && (
                            <TouchableOpacity style={styles.seeAllReviewsButton} onPress={() => setAllReviewsVisible(true)}>
                                <Text style={styles.seeAllReviewsText}>Voir les {reviews.length} avis</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </View>
            {onRemove && (
                <TouchableOpacity style={styles.removeButton} onPress={onRemove}>
                    <X size={14} color="#EF4444" />
                </TouchableOpacity>
            )}

            {/* Full Screen Reviews Modal */}
            <Modal
                visible={isAllReviewsVisible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setAllReviewsVisible(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Avis ({reviews.length})</Text>
                        <TouchableOpacity onPress={() => setAllReviewsVisible(false)} style={styles.modalCloseButton}>
                            <X size={24} color="#FFF" />
                        </TouchableOpacity>
                    </View>
                    <ScrollView contentContainerStyle={styles.modalContent}>
                        {reviews.map((review) => (
                            <View key={review.id} style={styles.modalReviewItem}>
                                <View style={styles.reviewHeader}>
                                    <View style={styles.reviewerInfo}>
                                        {review.user?.image ? (
                                            <Image source={{ uri: review.user.image }} style={styles.reviewerAvatarLarge} />
                                        ) : (
                                            <View style={[styles.reviewerAvatarLarge, { backgroundColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center' }]}>
                                                <User size={16} color="#9CA3AF" />
                                            </View>
                                        )}
                                        <View>
                                            <Text style={styles.reviewerNameLarge}>{review.user.name || 'Utilisateur'}</Text>
                                            <Text style={styles.reviewDate}>{new Date(review.createdAt).toLocaleDateString()}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.reviewRating}>
                                        {[1, 2, 3, 4, 5].map(s => (
                                            <Star key={s} size={12} color={review.rating >= s ? "#20B8CD" : "#4B5563"} fill={review.rating >= s ? "#20B8CD" : "none"} />
                                        ))}
                                    </View>
                                </View>
                                {review.comment && <Text style={styles.reviewCommentLarge}>{review.comment}</Text>}
                            </View>
                        ))}
                    </ScrollView>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    section: {
        backgroundColor: '#1A1A1A',
        borderWidth: 1,
        borderColor: '#2A2A2A',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    removableWrapper: {
        position: 'relative',
    },
    removeButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#0F0F0F',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    userRatingContainer: {
        marginBottom: 16,
    },
    subTitle: {
        fontSize: 12,
        color: '#9CA3AF',
        marginBottom: 8,
        fontWeight: '500',
    },
    starRow: {
        flexDirection: 'row',
        gap: 12,
    },
    commentInputContainer: {
        gap: 12,
        marginBottom: 16,
    },
    commentInput: {
        backgroundColor: '#121212',
        borderWidth: 1,
        borderColor: '#2A2A2A',
        borderRadius: 12,
        padding: 12,
        color: '#E5E7EB',
        minHeight: 80,
        textAlignVertical: 'top',
    },
    publishButton: {
        backgroundColor: '#20B8CD',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 8,
        gap: 8,
    },
    publishButtonText: {
        color: '#000',
        fontWeight: '600',
        fontSize: 14,
    },
    reviewsList: {
        gap: 12,
        borderTopWidth: 1,
        borderTopColor: '#2A2A2A',
        paddingTop: 16,
    },
    reviewItem: {
        backgroundColor: '#121212',
        borderRadius: 12,
        padding: 12,
    },
    reviewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    reviewerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    reviewerAvatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
    },
    reviewerName: {
        fontSize: 13,
        color: '#E5E7EB',
        fontWeight: '500',
    },
    reviewDate: {
        fontSize: 11,
        color: '#6B7280',
    },
    reviewRating: {
        flexDirection: 'row',
        gap: 2,
    },
    reviewComment: {
        fontSize: 13,
        color: '#9CA3AF',
        lineHeight: 20,
    },
    seeAllReviewsButton: {
        alignItems: 'center',
        marginTop: 8,
    },
    seeAllReviewsText: {
        color: '#20B8CD',
        fontSize: 13,
        fontWeight: '500',
    },
    modalContainer: {
        flex: 1,
        backgroundColor: '#1A1A1A',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#2A2A2A',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    modalCloseButton: {
        padding: 4,
    },
    modalContent: {
        padding: 16,
        gap: 16,
    },
    modalReviewItem: {
        backgroundColor: '#121212',
        borderRadius: 12,
        padding: 16,
    },
    reviewerAvatarLarge: {
        width: 32,
        height: 32,
        borderRadius: 16,
    },
    reviewerNameLarge: {
        fontSize: 14,
        color: '#E5E7EB',
        fontWeight: '500',
    },
    reviewCommentLarge: {
        fontSize: 14,
        color: '#D1D5DB',
        lineHeight: 22,
        marginTop: 8,
    },
});
