import { useAuth } from '@/src/app/providers/AuthContext';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { ReviewService } from '@/src/shared/api/ReviewService';
import { User as UserType } from '@/src/shared/api/types';
import { UserAvatar } from '@/src/entities/user/ui/UserAvatar';
import { UGCModerationService } from '@/src/shared/api/UGCModerationService';
import { useSmartNavigation } from '@/src/shared/navigation/useSmartNavigation';
import { ThemeColors } from '@/src/shared/theme';
import { MoreHorizontal, Send, Star, Trash2, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { Review } from '../model/Review';

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
    const [, setIsLoading] = useState(false);
    const { user } = useAuth();
    const { navigateToUserProfile } = useSmartNavigation();

    const myReview = useMemo(() => {
        if (!user) return null;
        return reviews.find(r => r.user && String(r.user.id) === String(user.id)) || null;
    }, [reviews, user]);

    const communityReviews = useMemo(() => {
        if (!user) return reviews;
        return reviews.filter(r => !r.user || String(r.user.id) !== String(user.id));
    }, [reviews, user]);

    const [prevMyReviewId, setPrevMyReviewId] = useState<string | number | undefined>(undefined);
    if (myReview?.id !== prevMyReviewId) {
        setPrevMyReviewId(myReview?.id);
        setRating(myReview?.rating || 0);
        setComment(myReview?.comment || '');
    }

    const loadReviews = useCallback(async () => {
        setIsLoading(true);
        console.log(`[ReviewBlock] Fetching reviews for bookId: ${bookId}`);
        try {
            const fetchedReviews = await ReviewService.getReviewsByBookId(bookId);
            console.log(`[ReviewBlock] Fetched ${fetchedReviews.length} reviews`);
            
            const blockedUsers = await UGCModerationService.getBlockedUsers();
            const reportedReviews = await UGCModerationService.getReportedReviews();
            
            const filteredReviews = fetchedReviews.filter(review => {
                const userId = review.user?.id ? String(review.user.id) : null;
                const reviewId = String(review.id);
                if (userId && blockedUsers.includes(userId)) return false;
                if (reportedReviews.includes(reviewId)) return false;
                return true;
            });
            
            setReviews(filteredReviews);
        } catch (error) {
            console.error("[ReviewBlock] Error loading reviews:", error);
            Alert.alert("Erreur", "Impossible de charger les avis. Veuillez vérifier votre connexion.");
        } finally {
            setIsLoading(false);
        }
    }, [bookId]);

    useEffect(() => {
        Promise.resolve().then(() => {
            loadReviews();
        });
    }, [loadReviews]);


    const handleReportReview = (reviewId: string | number) => {
        Alert.alert(
            "Signaler cet avis",
            "Êtes-vous sûr de vouloir signaler ce contenu comme offensant ou inapproprié ?",
            [
                { text: "Annuler", style: "cancel" },
                { 
                    text: "Signaler", 
                    style: "destructive",
                    onPress: async () => {
                        await UGCModerationService.reportReview(reviewId);
                        Alert.alert("Succès", "Cet avis a été signalé et masqué.");
                        loadReviews(); // Reload to apply filters
                    }
                }
            ]
        );
    };

    const handleBlockUser = (userId: string | number | undefined) => {
        if (!userId) return;
        Alert.alert(
            "Bloquer l'utilisateur",
            "Voulez-vous vraiment bloquer cet utilisateur ? Vous ne verrez plus aucun de ses avis.",
            [
                { text: "Annuler", style: "cancel" },
                { 
                    text: "Bloquer", 
                    style: "destructive",
                    onPress: async () => {
                        await UGCModerationService.blockUser(userId);
                        Alert.alert("Succès", "Utilisateur bloqué. Ses avis seront masqués.");
                        loadReviews(); // Reload to apply filters
                    }
                }
            ]
        );
    };

    const handleUserPress = (reviewUser: UserType) => {
        if (reviewUser && reviewUser.username) {
            setAllReviewsVisible(false); // Close modal if open
            navigateToUserProfile(reviewUser.username);
        }
    };

    const handleDeleteMyReview = () => {
        if (!myReview) return;
        Alert.alert(
            "Supprimer l'avis",
            "Êtes-vous sûr de vouloir supprimer votre avis ?",
            [
                { text: "Annuler", style: "cancel" },
                { 
                    text: "Supprimer", 
                    style: "destructive",
                    onPress: async () => {
                        const success = await ReviewService.deleteReview(myReview.id);
                        if (success) {
                            setReviews(prev => prev.filter(r => r.id !== myReview.id));
                            setRating(0);
                            setComment('');
                            Alert.alert("Succès", "Votre avis a été supprimé.");
                            loadReviews();
                            if (onReviewAdded) onReviewAdded();
                        } else {
                            Alert.alert("Erreur", "Impossible de supprimer l'avis.");
                        }
                    }
                }
            ]
        );
    };

    const handleReviewOptions = (review: Review) => {
        Alert.alert(
            "Options",
            "Que souhaitez-vous faire avec cet avis ?",
            [
                { text: "Signaler ce contenu", onPress: () => handleReportReview(review.id) },
                { text: "Bloquer cet utilisateur", onPress: () => handleBlockUser(review.user?.id) },
                { text: "Annuler", style: "cancel" }
            ],
            { cancelable: true }
        );
    };

    const handlePublishReview = async () => {
        if (rating === 0) {
            Alert.alert("Erreur", "Veuillez donner une note.");
            return;
        }

        if (UGCModerationService.containsOffensiveContent(comment)) {
            Alert.alert("Erreur", "Votre commentaire contient un langage inapproprié et ne peut pas être publié.");
            return;
        }

        if (myReview) {
            const updatedReview = await ReviewService.updateReview(myReview.id, {
                rating,
                comment,
            });

            if (updatedReview) {
                setReviews(prev => prev.map(r => r.id === myReview.id ? { ...r, rating, comment } : r));
                Alert.alert("Succès", "Votre avis a été mis à jour !");
                loadReviews();
                if (onReviewAdded) {
                    onReviewAdded();
                }
            } else {
                Alert.alert("Erreur", "Impossible de mettre à jour l'avis.");
            }
        } else {
            const newReview = await ReviewService.createReview({
                rating,
                comment,
                bookId,
            });

            if (newReview) {
                setReviews(prev => [newReview, ...prev]);
                Alert.alert("Succès", "Votre avis a été publié !");
                loadReviews();
                if (onReviewAdded) {
                    onReviewAdded();
                }
            } else {
                Alert.alert("Erreur", "Impossible de publier l'avis.");
            }
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
                            <TouchableOpacity
                                key={star}
                                onPress={() => setRating(star)}
                                accessible={true}
                                accessibilityLabel={`Noter ${star} étoiles sur 5`}
                                accessibilityRole="button"
                                testID={`star-rating-${star}`}
                            >
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
                        accessible={true}
                        accessibilityLabel="Écrire votre avis"
                        testID="review-input"
                    />
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                            style={[styles.publishButton, { flex: 1 }]}
                            onPress={handlePublishReview}
                            accessible={true}
                            accessibilityLabel="Publier l'avis"
                            accessibilityRole="button"
                            testID="publish-review-button"
                        >
                            <Send size={14} color="#FFF" />
                            <Text style={styles.publishButtonText}>{myReview ? "Mettre à jour" : "Publier"}</Text>
                        </TouchableOpacity>
                        {myReview && (
                            <TouchableOpacity
                                style={[styles.publishButton, { backgroundColor: colors.surfaceHighlight, paddingHorizontal: 16 }]}
                                onPress={handleDeleteMyReview}
                                accessible={true}
                                accessibilityLabel="Supprimer mon avis"
                                accessibilityRole="button"
                                testID="delete-review-button"
                            >
                                <Trash2 size={16} color={colors.warning} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Other reviews list */}
                {communityReviews.length > 0 && (
                    <View style={styles.reviewsList}>
                        <Text style={styles.subTitle}>Avis de la communauté</Text>
                        {communityReviews.slice(0, 2).map((review) => (
                            <View key={review.id} style={styles.reviewItem}>
                                <View style={styles.reviewHeader}>
                                    <TouchableOpacity
                                        style={styles.reviewerInfo}
                                        onPress={() => handleUserPress(review.user)}
                                        accessible={true}
                                        accessibilityLabel={`Profil de ${review.user?.name || 'l\'utilisateur'}`}
                                        accessibilityRole="button"
                                    >
                                        <UserAvatar
                                            user={review.user}
                                            size={24}
                                            style={styles.reviewerAvatar}
                                        />
                                        <View>
                                            <Text style={styles.reviewerName}>{review.user?.name || 'Utilisateur'}</Text>
                                            <Text style={styles.reviewDate}>{new Date(review.createdAt).toLocaleDateString()}</Text>
                                        </View>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={{ padding: 4 }}
                                        onPress={() => handleReviewOptions(review)}
                                        accessible={true}
                                        accessibilityLabel="Options de l'avis"
                                        accessibilityRole="button"
                                    >
                                        <MoreHorizontal size={16} color={colors.textTertiary} />
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.reviewRating}>
                                    {[1, 2, 3, 4, 5].map(s => (
                                        <Star key={s} size={10} color={review.rating >= s ? colors.primary : colors.textTertiary} fill={review.rating >= s ? colors.primary : "none"} />
                                    ))}
                                </View>
                                {review.comment && <Text style={styles.reviewComment}>{review.comment}</Text>}
                            </View>
                        ))}
                        {communityReviews.length > 2 && (
                            <TouchableOpacity
                                style={styles.seeAllReviewsButton}
                                onPress={() => setAllReviewsVisible(true)}
                                accessible={true}
                                accessibilityLabel="Voir tous les avis"
                                accessibilityRole="button"
                                testID="see-all-reviews-button"
                            >
                                <Text style={styles.seeAllReviewsText}>Voir les {communityReviews.length} avis</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </View>
            {onRemove && (
                <TouchableOpacity
                    style={styles.removeButton}
                    onPress={onRemove}
                    accessible={true}
                    accessibilityLabel="Enlever le bloc d'avis"
                    accessibilityRole="button"
                    testID="remove-review-block-button"
                >
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
                        <Text style={styles.modalTitle}>Avis ({communityReviews.length})</Text>
                        <TouchableOpacity
                            onPress={() => setAllReviewsVisible(false)}
                            style={styles.modalCloseButton}
                            accessible={true}
                            accessibilityLabel="Fermer"
                            accessibilityRole="button"
                            testID="close-reviews-modal-button"
                        >
                            <X size={24} color={colors.text} />
                        </TouchableOpacity>
                    </View>
                    <ScrollView contentContainerStyle={styles.modalContent}>
                        {communityReviews.map((review) => (
                            <View key={review.id} style={styles.modalReviewItem}>
                                <View style={styles.reviewHeader}>
                                    <TouchableOpacity style={styles.reviewerInfo} onPress={() => handleUserPress(review.user)}>
                                        <UserAvatar
                                            user={review.user}
                                            size={32}
                                            style={styles.reviewerAvatarLarge}
                                        />
                                        <View>
                                            <Text style={styles.reviewerNameLarge}>{review.user?.name || 'Utilisateur'}</Text>
                                            <Text style={styles.reviewDate}>{new Date(review.createdAt).toLocaleDateString()}</Text>
                                        </View>
                                    </TouchableOpacity>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                        <View style={styles.reviewRating}>
                                            {[1, 2, 3, 4, 5].map(s => (
                                                <Star key={s} size={12} color={review.rating >= s ? colors.primary : colors.textTertiary} fill={review.rating >= s ? colors.primary : "none"} />
                                            ))}
                                        </View>
                                        <TouchableOpacity style={{ padding: 4 }} onPress={() => handleReviewOptions(review)}>
                                            <MoreHorizontal size={20} color={colors.textTertiary} />
                                        </TouchableOpacity>
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
};

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
