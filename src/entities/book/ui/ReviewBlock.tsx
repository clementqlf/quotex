import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, TextInput, Image, StyleSheet, Modal, ScrollView, Alert } from 'react-native';
import { Star, User, Send, X } from 'lucide-react-native';
import { Review, User as UserType } from '@/src/shared/api/types';
import { ReviewService } from '@/src/shared/api/ReviewService';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { ThemeColors } from '@/src/shared/theme';

interface ReviewBlockProps {
    bookId: number;
    onRemove?: () => void;
    onReviewAdded?: () => void;
}

const ReviewBlockUI: React.FC<ReviewBlockProps> = ({ bookId, onRemove, onReviewAdded }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

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

        const newReview = await ReviewService.createReview({
            rating,
            comment,
            bookId,
        });

        if (newReview) {
            setReviews([newReview, ...reviews]);
            setRating(0);
            setComment('');
            Alert.alert("Succès", "Votre avis a été publié !");
            if (onReviewAdded) {
                onReviewAdded();
            }
        } else {
            Alert.alert("Erreur", "Impossible de publier l'avis.");
        }
    };

    return (
        <View style={styles.removableWrapper}>
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Star size={16} color={colors.primary} />
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
                                    color={rating >= star ? colors.primary : colors.textTertiary}
                                    fill={rating >= star ? colors.primary : "none"}
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
                        placeholderTextColor={colors.textTertiary}
                        multiline
                        value={comment}
                        onChangeText={setComment}
                    />
                    <TouchableOpacity style={styles.publishButton} onPress={handlePublishReview}>
                        <Send size={14} color="#FFF" />
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
                                            <View style={[styles.reviewerAvatar, { backgroundColor: colors.surfaceHighlight, alignItems: 'center', justifyContent: 'center' }]}>
                                                <User size={12} color={colors.textTertiary} />
                                            </View>
                                        )}
                                        <Text style={styles.reviewerName}>{review.user?.name || 'Utilisateur'}</Text>
                                    </View>
                                    <Text style={styles.reviewDate}>{new Date(review.createdAt).toLocaleDateString()}</Text>
                                </View>
                                <View style={styles.reviewRating}>
                                    {[1, 2, 3, 4, 5].map(s => (
                                        <Star key={s} size={10} color={review.rating >= s ? colors.primary : colors.textTertiary} fill={review.rating >= s ? colors.primary : "none"} />
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
                    <X size={14} color={colors.warning} />
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
                            <X size={24} color={colors.text} />
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
                                            <View style={[styles.reviewerAvatarLarge, { backgroundColor: colors.surfaceHighlight, alignItems: 'center', justifyContent: 'center' }]}>
                                                <User size={16} color={colors.textTertiary} />
                                            </View>
                                        )}
                                        <View>
                                            <Text style={styles.reviewerNameLarge}>{review.user?.name || 'Utilisateur'}</Text>
                                            <Text style={styles.reviewDate}>{new Date(review.createdAt).toLocaleDateString()}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.reviewRating}>
                                        {[1, 2, 3, 4, 5].map(s => (
                                            <Star key={s} size={12} color={review.rating >= s ? colors.primary : colors.textTertiary} fill={review.rating >= s ? colors.primary : "none"} />
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

const ReviewBlock = React.memo(ReviewBlockUI, (prevProps, nextProps) => {
    return prevProps.bookId === nextProps.bookId;
});

export default ReviewBlock;

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    section: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.surfaceHighlight,
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
        color: colors.text,
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
        backgroundColor: colors.surfaceHighlight,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    userRatingContainer: {
        marginBottom: 16,
    },
    subTitle: {
        fontSize: 12,
        color: colors.textSecondary,
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
        backgroundColor: colors.inputBackground,
        borderWidth: 1,
        borderColor: colors.surfaceHighlight,
        borderRadius: 12,
        padding: 12,
        color: colors.inputText,
        minHeight: 80,
        textAlignVertical: 'top',
    },
    publishButton: {
        backgroundColor: colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 8,
        gap: 8,
    },
    publishButtonText: {
        color: '#FFF', // Primary button text usually white
        fontWeight: '600',
        fontSize: 14,
    },
    reviewsList: {
        gap: 12,
        borderTopWidth: 1,
        borderTopColor: colors.surfaceHighlight,
        paddingTop: 16,
    },
    reviewItem: {
        backgroundColor: colors.surfaceHighlight,
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
        color: colors.text,
        fontWeight: '500',
    },
    reviewDate: {
        fontSize: 11,
        color: colors.textTertiary,
    },
    reviewRating: {
        flexDirection: 'row',
        gap: 2,
    },
    reviewComment: {
        fontSize: 13,
        color: colors.textSecondary,
        lineHeight: 20,
    },
    seeAllReviewsButton: {
        alignItems: 'center',
        marginTop: 8,
    },
    seeAllReviewsText: {
        color: colors.primary,
        fontSize: 13,
        fontWeight: '500',
    },
    modalContainer: {
        flex: 1,
        backgroundColor: colors.background,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
    },
    modalCloseButton: {
        padding: 4,
    },
    modalContent: {
        padding: 16,
        gap: 16,
    },
    modalReviewItem: {
        backgroundColor: colors.surfaceHighlight,
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
        color: colors.text,
        fontWeight: '500',
    },
    reviewCommentLarge: {
        fontSize: 14,
        color: colors.textSecondary,
        lineHeight: 22,
        marginTop: 8,
    },
});
