import { useAuth } from '@/src/app/providers/AuthContext';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { User as UserType } from '@/src/shared/api/types';
import { Avatar } from '@/src/shared/ui/Avatar';
import { UGCModerationService } from '@/src/shared/api/UGCModerationService';
import { useSmartNavigation } from '@/src/shared/navigation/useSmartNavigation';
import { ThemeColors, tokens as defaultTokens } from '@/src/shared/theme';
import {
  useReviewsByBookId,
  useCreateReview,
  useUpdateReview,
  useDeleteReview,
} from '../lib/useReviewService';
import type { Review } from '../model/Review';
import { MoreHorizontal, Send, Star, Trash2, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface ReviewBlockProps {
    bookId: number;
    onRemove?: () => void;
    onReviewAdded?: () => void;
}

const ReviewBlockUI: React.FC<ReviewBlockProps> = ({ bookId, onRemove, onReviewAdded }) => {
    const { colors, tokens = defaultTokens } = useTheme();
    const styles = useMemo(() => createStyles(colors, tokens), [colors, tokens]);

    const { data: fetchedReviews, refetch } = useReviewsByBookId(bookId);
    const createReviewMutation = useCreateReview();
    const updateReviewMutation = useUpdateReview();
    const deleteReviewMutation = useDeleteReview();

    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [isAllReviewsVisible, setAllReviewsVisible] = useState(false);
    const { user } = useAuth();
    const { navigateToUserProfile } = useSmartNavigation();

    const [reviews, setReviews] = useState<Review[]>([]);

    useEffect(() => {
      const loadAndFilterReviews = async () => {
        if (!fetchedReviews) return;
        
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
      };

      loadAndFilterReviews();
    }, [fetchedReviews]);

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

    const reloadReviews = useCallback(async () => {
        try {
            await refetch();
        } catch (error) {
            console.error("[ReviewBlock] Error refetching reviews:", error);
            Alert.alert("Erreur", "Impossible de recharger les avis. Veuillez vérifier votre connexion.");
        }
    }, [refetch]);

    useEffect(() => {
        if (bookId) {
            refetch();
        }
    }, [bookId, refetch]);


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
                        await reloadReviews();
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
                        await reloadReviews();
                    }
                }
            ]
        );
    };

    const handleUserPress = (reviewUser: UserType) => {
        if (reviewUser && reviewUser.username) {
            setAllReviewsVisible(false);
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
                        try {
                            await deleteReviewMutation.mutateAsync(myReview.id);
                            setReviews(prev => prev.filter(r => r.id !== myReview.id));
                            setRating(0);
                            setComment('');
                            Alert.alert("Succès", "Votre avis a été supprimé.");
                            await reloadReviews();
                            if (onReviewAdded) onReviewAdded();
                        } catch (error) {
                            console.error("[ReviewBlock] Error deleting review:", error);
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

        try {
            if (myReview) {
                await updateReviewMutation.mutateAsync({
                    reviewId: myReview.id,
                    review: {
                        rating,
                        comment,
                    },
                });

                setReviews(prev => prev.map(r => r.id === myReview.id ? { ...r, rating, comment } : r));
                Alert.alert("Succès", "Votre avis a été mis à jour !");
                await reloadReviews();
                if (onReviewAdded) {
                    onReviewAdded();
                }
            } else {
                const newReview = await createReviewMutation.mutateAsync({
                    rating,
                    comment,
                    bookId,
                });

                setReviews(prev => [newReview, ...prev]);
                Alert.alert("Succès", "Votre avis a été publié !");
                await reloadReviews();
                if (onReviewAdded) {
                    onReviewAdded();
                }
            }
        } catch (error) {
            console.error("[ReviewBlock] Error publishing review:", error);
            Alert.alert("Erreur", myReview ? "Impossible de mettre à jour l'avis." : "Impossible de publier l'avis.");
        }
    };

    return (
        <View style={styles.removableWrapper}>
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Star size={16} color={colors.primary} />
                    <Text style={styles.sectionTitle}>Avis & Commentaires</Text>
                </View>

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
                                        <Avatar
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
                                        <Avatar
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

const createStyles = (colors: ThemeColors, tokens: any) => StyleSheet.create({
    section: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.surfaceHighlight,
        borderRadius: tokens.radii.lg,
        padding: tokens.spacing.md,
        marginBottom: tokens.spacing.md,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: tokens.spacing.sm,
        marginBottom: tokens.spacing.sm + 4,
    },
    sectionTitle: {
        fontSize: tokens.typography.fontSize.sm,
        fontWeight: tokens.typography.fontWeight.semibold,
        color: colors.text,
    },
    removableWrapper: {
        position: 'relative',
    },
    removeButton: {
        position: 'absolute',
        top: tokens.spacing.sm,
        right: tokens.spacing.sm,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.surfaceHighlight,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    userRatingContainer: {
        marginBottom: tokens.spacing.md,
    },
    subTitle: {
        fontSize: tokens.typography.fontSize.xs,
        color: colors.textSecondary,
        marginBottom: tokens.spacing.sm,
        fontWeight: tokens.typography.fontWeight.medium,
    },
    starRow: {
        flexDirection: 'row',
        gap: tokens.spacing.sm + 4,
    },
    commentInputContainer: {
        gap: tokens.spacing.sm + 4,
        marginBottom: tokens.spacing.md,
    },
    commentInput: {
        backgroundColor: colors.inputBackground,
        borderWidth: 1,
        borderColor: colors.surfaceHighlight,
        borderRadius: tokens.radii.md,
        padding: tokens.spacing.sm + 4,
        color: colors.inputText,
        minHeight: 80,
        textAlignVertical: 'top',
    },
    publishButton: {
        backgroundColor: colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: tokens.spacing.sm + 4,
        borderRadius: tokens.radii.sm,
        gap: tokens.spacing.sm,
    },
    publishButtonText: {
        color: '#FFF',
        fontWeight: tokens.typography.fontWeight.semibold,
        fontSize: tokens.typography.fontSize.sm,
    },
    reviewsList: {
        gap: tokens.spacing.sm + 4,
        borderTopWidth: 1,
        borderTopColor: colors.surfaceHighlight,
        paddingTop: tokens.spacing.md,
    },
    reviewItem: {
        backgroundColor: colors.surfaceHighlight,
        borderRadius: tokens.radii.md,
        padding: tokens.spacing.sm + 4,
    },
    reviewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: tokens.spacing.sm,
    },
    reviewerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: tokens.spacing.sm,
    },
    reviewerAvatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
    },
    reviewerName: {
        fontSize: tokens.typography.fontSize.xs + 1,
        color: colors.text,
        fontWeight: tokens.typography.fontWeight.medium,
    },
    reviewDate: {
        fontSize: tokens.typography.fontSize.xs - 1,
        color: colors.textTertiary,
    },
    reviewRating: {
        flexDirection: 'row',
        gap: 2,
    },
    reviewComment: {
        fontSize: tokens.typography.fontSize.xs + 1,
        color: colors.textSecondary,
        lineHeight: tokens.typography.lineHeight.sm,
    },
    seeAllReviewsButton: {
        alignItems: 'center',
        marginTop: tokens.spacing.sm,
    },
    seeAllReviewsText: {
        color: colors.primary,
        fontSize: tokens.typography.fontSize.xs + 1,
        fontWeight: tokens.typography.fontWeight.medium,
    },
    modalContainer: {
        flex: 1,
        backgroundColor: colors.background,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: tokens.spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    modalTitle: {
        fontSize: tokens.typography.fontSize.lg,
        fontWeight: tokens.typography.fontWeight.semibold,
        color: colors.text,
    },
    modalCloseButton: {
        padding: tokens.spacing.xs,
    },
    modalContent: {
        padding: tokens.spacing.md,
        gap: tokens.spacing.md,
    },
    modalReviewItem: {
        backgroundColor: colors.surfaceHighlight,
        borderRadius: tokens.radii.md,
        padding: tokens.spacing.md,
    },
    reviewerAvatarLarge: {
        width: 32,
        height: 32,
        borderRadius: 16,
    },
    reviewerNameLarge: {
        fontSize: tokens.typography.fontSize.sm,
        color: colors.text,
        fontWeight: tokens.typography.fontWeight.medium,
    },
    reviewCommentLarge: {
        fontSize: tokens.typography.fontSize.sm,
        color: colors.textSecondary,
        lineHeight: tokens.typography.lineHeight.md - 2,
        marginTop: tokens.spacing.sm,
    },
});
