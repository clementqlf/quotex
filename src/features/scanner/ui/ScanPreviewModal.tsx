import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Keyboard,
    Dimensions,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Heart, Share2, X, Book as BookIcon, User as UserIcon } from 'lucide-react-native';
import { bookDescriptions, localQuotesDB } from '@/src/shared/api/staticData';
import { useData } from '@/src/app/providers/DataProvider';
import { searchService } from '@/src/features/search/api/SearchService';
import { API_BASE_URL } from '@/src/shared/config/api';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { ThemeColors } from '@/src/shared/theme';
import { getAuthorName, getBookTitle } from '@/src/shared/lib/dataHelpers';
import {
  CannonConfetti,
  type CannonConfettiMethods
} from 'react-native-fast-confetti';

type ScanPreviewModalProps = {
    visible: boolean;
    onClose: () => void;
    onConfirm: (quote: string, book: string, author: string) => void | Promise<void>;
    scannedText: string;
    initialBook?: string;
    initialAuthor?: string;
    showConfetti?: boolean;
};

export default function ScanPreviewModal({
    visible,
    onClose,
    onConfirm,
    scannedText,
    initialBook = '',
    initialAuthor = '',
    showConfetti = false,
}: ScanPreviewModalProps) {
    const { quotes } = useData();
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const cannonConfettiRef = useRef<CannonConfettiMethods>(null);

    // State for editing
    const [isEditingBook, setIsEditingBook] = useState(false);
    const [isEditingAuthor, setIsEditingAuthor] = useState(false);
    const [isEditingQuote, setIsEditingQuote] = useState(false);

    const [editedBook, setEditedBook] = useState('');
    const [editedAuthor, setEditedAuthor] = useState('');
    const [editedQuote, setEditedQuote] = useState('');

    // State for Book Suggestions
    type SuggestionItem = { type: 'local' | 'inventaire' | 'database'; title: string; author?: string; data?: any };
    const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

    // State for Author Suggestions
    type AuthorSuggestionItem = { type: 'local' | 'database' | 'inventaire'; name: string; data?: any };
    const [authorSuggestions, setAuthorSuggestions] = useState<AuthorSuggestionItem[]>([]);
    const [showAuthorSuggestions, setShowAuthorSuggestions] = useState(false);
    const [isLoadingAuthorSuggestions, setIsLoadingAuthorSuggestions] = useState(false);

    // Initial books fro local data (quotes)
    const initialBooks = useMemo(() => {
        const bookMap = new Map<string, string>(); // title -> author
        quotes.forEach(q => {
            if (q.book) {
                const title = typeof q.book === 'string' ? q.book : q.book.title;
                const author = getAuthorName(q.author);
                if (title && !bookMap.has(title)) {
                    bookMap.set(title, author);
                }
            }
        });
        return Array.from(bookMap.entries()).map(([title, author]) => ({ title, author }));
    }, [quotes]);

    // Initial authors from local data (quotes)
    const initialAuthors = useMemo((): AuthorSuggestionItem[] => {
        const authors = new Set<string>();
        quotes.forEach(q => {
            if (q.author) {
                if (typeof q.author === 'string') {
                    authors.add(q.author);
                } else if (q.author?.name) {
                    authors.add(q.author.name);
                }
            }
        });
        return Array.from(authors).map(name => ({ type: 'local' as const, name }));
    }, [quotes]);

    // Reset state when modal opens or scannedText changes
    useEffect(() => {
        if (visible) {
            setIsSubmitting(false);
            setEditedQuote(''); // We'll let defaultValue handle it unless explicitly editing
            setEditedBook(initialBook);
            setEditedAuthor(initialAuthor);
            setIsEditingBook(false);
            setIsEditingAuthor(false);
            // If we have initial valus, we might not want to start in edit mode for quote? 
            // Actually existing logic checks scannedText.
            // If it's an edit (initialBook provided), we probably want to treat it slightly differently?
            // Existing logic: setIsEditingQuote(!scannedText);
            // Let's keep it simple. If we are editing, we usually pass scannedText as the existing quote text.
            setIsEditingQuote(!scannedText);
            setShowSuggestions(false);
            setShowAuthorSuggestions(false);
            
            // Redémarre les confettis avec les cannons quand le modal s'ouvre
            if (showConfetti) {
                cannonConfettiRef.current?.restart();
            }
        }
    }, [visible, scannedText, initialBook, initialAuthor, showConfetti]);

    const resolveBookTitle = () => {
        if (editedBook.trim()) return editedBook.trim();
        if (initialBook && initialBook !== 'Livre inconnu') return initialBook;

        return (
            Object.keys(bookDescriptions).find((title) =>
                localQuotesDB.some((q) => q.text === scannedText && q.book === title)
            ) || ''
        );
    };

    const resolveAuthorName = () => {
        if (editedAuthor.trim()) return editedAuthor.trim();
        if (initialAuthor && initialAuthor !== 'Auteur inconnu' && !editedBook.trim()) return initialAuthor;

        const bookTitle = resolveBookTitle();
        if (initialBook && initialBook !== 'Livre inconnu' && bookTitle === initialBook && initialAuthor && initialAuthor !== 'Auteur inconnu') return initialAuthor;

        return bookDescriptions[bookTitle]?.author || '';
    };

    const handleConfirm = async () => {
        console.log('[ScanPreviewModal] handleConfirm called');
        console.log('[ScanPreviewModal] isSubmitting:', isSubmitting);
        console.log('[ScanPreviewModal] editedQuote:', editedQuote);
        console.log('[ScanPreviewModal] scannedText:', scannedText);
        
        if (isSubmitting) {
            console.log('[ScanPreviewModal] Already submitting, returning');
            return;
        }

        const finalText = editedQuote.trim() || scannedText;
        console.log('[ScanPreviewModal] finalText:', finalText);
        
        if (!finalText) {
            console.log('[ScanPreviewModal] No text to save, returning');
            return;
        }
        
        const finalBook = editedBook.trim() || resolveBookTitle();
        const finalAuthor = editedAuthor.trim() || resolveAuthorName();
        console.log('[ScanPreviewModal] finalBook:', finalBook);
        console.log('[ScanPreviewModal] finalAuthor:', finalAuthor);

        setIsSubmitting(true);
        try {
            console.log('[ScanPreviewModal] Calling onConfirm...');
            await onConfirm(finalText, finalBook, finalAuthor);
            console.log('[ScanPreviewModal] onConfirm completed successfully');
        } catch (error) {
            console.error("[ScanPreviewModal] Error confirming quote:", error);
            setIsSubmitting(false);
        } finally {
            console.log('[ScanPreviewModal] Setting isSubmitting to false');
            setIsSubmitting(false);
        }
    };

    const handleBookChange = (text: string) => {
        setEditedBook(text);
        if (!text.trim()) {
            setSuggestions(initialBooks.map(b => ({ type: 'local' as const, title: b.title, author: b.author })));
            setShowSuggestions(true);
        }
    };

    // Debounced Book Search
    useEffect(() => {
        if (!isEditingBook || !editedBook.trim() || editedBook.trim().length < 3) {
            if (editedBook.trim().length === 0) {
                setSuggestions(initialBooks.map(b => ({ type: 'local' as const, title: b.title, author: b.author })));
            }
            return;
        }

        const timer = setTimeout(async () => {
            setIsLoadingSuggestions(true);
            try {
                const results = await searchService.search(editedBook).catch(() => ({ books: [], inventaireWorks: [] }));

                const dbItems: SuggestionItem[] = (results.books || []).map((b: any) => ({
                    type: 'database',
                    title: b.title,
                    author: b.authors && b.authors.length > 0
                        ? b.authors[0]
                        : getAuthorName(b.author),
                    data: b
                }));

                const localMatches: SuggestionItem[] = initialBooks
                    .filter(b => b.title.toLowerCase().includes(editedBook.toLowerCase()))
                    .map(b => ({ type: 'local' as const, title: b.title, author: b.author }));

                const inventaireItems: SuggestionItem[] = ((results as any).inventaireWorks || []).map((w: any) => ({
                    type: 'inventaire',
                    title: w.label || w.title || '',
                    author: w.authors && w.authors.length > 0 ? w.authors[0] : undefined,
                    data: w
                }));

                const seenTitles = new Set<string>();
                const combined: SuggestionItem[] = [];

                [...dbItems, ...localMatches, ...inventaireItems].forEach(item => {
                    if (!seenTitles.has(item.title.toLowerCase())) {
                        seenTitles.add(item.title.toLowerCase());
                        combined.push(item);
                    }
                });

                setSuggestions(combined);
            } catch (error) {
                console.error("Error searching books", error);
            } finally {
                setIsLoadingSuggestions(false);
            }
        }, 500); // 500ms debounce

        return () => clearTimeout(timer);
    }, [editedBook, isEditingBook]);

    const handleAuthorChange = (text: string) => {
        setEditedAuthor(text);
        if (!text.trim()) {
            setAuthorSuggestions(initialAuthors);
            setShowAuthorSuggestions(true);
        }
    };

    // Debounced Author Search
    useEffect(() => {
        if (!isEditingAuthor || !editedAuthor.trim() || editedAuthor.trim().length < 3) {
            if (editedAuthor.trim().length === 0) {
                setAuthorSuggestions(initialAuthors);
            }
            return;
        }

        const timer = setTimeout(async () => {
            setIsLoadingAuthorSuggestions(true);
            try {
                const results = await searchService.search(editedAuthor);

                const dbItems: AuthorSuggestionItem[] = (results.authors || []).map((a: any) => ({
                    type: 'database' as const,
                    name: a.name,
                    data: a
                }));

                const localMatches: AuthorSuggestionItem[] = initialAuthors
                    .filter(a => a.name.toLowerCase().includes(editedAuthor.toLowerCase()));

                const inventaireItems: AuthorSuggestionItem[] = ((results as any).inventaireAuthors || []).map((a: any) => ({
                    type: 'inventaire' as const,
                    name: a.label || a.name || '',
                    data: a
                }));

                const seenNames = new Set<string>();
                const combined: AuthorSuggestionItem[] = [];

                [...dbItems, ...localMatches, ...inventaireItems].forEach(item => {
                    if (!seenNames.has(item.name.toLowerCase())) {
                        seenNames.add(item.name.toLowerCase());
                        combined.push(item);
                    }
                });

                setAuthorSuggestions(combined);
            } catch (error) {
                console.error("Error searching authors", error);
            } finally {
                setIsLoadingAuthorSuggestions(false);
            }
        }, 500); // 500ms debounce

        return () => clearTimeout(timer);
    }, [editedAuthor, isEditingAuthor]);

    const bookTitle = resolveBookTitle();
    const authorName = resolveAuthorName();
    const isBookUnknown = !bookTitle || bookTitle === 'Livre inconnu';
    const isAuthorUnknown = !authorName || authorName === 'Auteur inconnu';

    return (
        <Modal
            animationType="slide"
            transparent
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={{ flex: 1 }}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                >
                    <Pressable
                        style={styles.previewBackdrop}
                        onPress={onClose}
                    >
                        <Pressable
                            style={styles.previewContainer}
                            onPress={(e) => {
                                e.stopPropagation();
                                Keyboard.dismiss(); // Dismiss keyboard when tapping background
                            }}
                        >
                            <View style={styles.previewHeader}>
                                <Text style={styles.previewTitle}>Aperçu de la citation</Text>
                                <TouchableOpacity onPress={onClose}>
                                    <X size={24} color={colors.textSecondary} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={styles.previewScrollView} keyboardShouldPersistTaps="handled">
                                <View style={styles.previewQuoteCard}>
                                    <Svg
                                        width={32}
                                        height={32}
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        style={styles.quoteIcon}
                                    >
                                        <Path
                                            d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"
                                            fill="#20B8CD"
                                            opacity={0.12}
                                        />
                                    </Svg>

                                    {isEditingQuote ? (
                                        <TextInput
                                            style={styles.previewQuoteInput}
                                            value={editedQuote}
                                            defaultValue={scannedText}
                                            autoFocus
                                            multiline
                                            onChangeText={setEditedQuote}
                                            onBlur={() => setIsEditingQuote(false)}
                                            placeholderTextColor={colors.textTertiary}
                                            returnKeyType="done"
                                        />
                                    ) : (
                                        <TouchableOpacity
                                            onPress={() => {
                                                setIsEditingQuote(true);
                                                setEditedQuote(editedQuote || scannedText);
                                            }}
                                        >
                                            <Text style={[styles.previewQuoteText, !editedQuote && !scannedText && { color: colors.textTertiary, fontStyle: 'italic', fontFamily: 'Times New Roman' }]}>
                                                {editedQuote || scannedText || "Toucher pour ajouter une citation..."}
                                            </Text>
                                        </TouchableOpacity>
                                    )}

                                    <View style={styles.previewBookInfo}>
                                        <View style={styles.bookInfoLeft}>
                                            <View style={{ zIndex: 20 }}>
                                                {isEditingBook ? (
                                                    <View>
                                                        <TextInput
                                                            style={styles.bookTitleInput}
                                                            value={editedBook}
                                                            autoFocus
                                                            onChangeText={handleBookChange}
                                                            onBlur={() => {
                                                                // Delayed close to allow pressing suggestion
                                                                setTimeout(() => {
                                                                    setIsEditingBook(false);
                                                                    setShowSuggestions(false);
                                                                }, 200);
                                                            }}
                                                            placeholder="Titre du livre"
                                                            placeholderTextColor={colors.textTertiary}
                                                            returnKeyType="done"
                                                            onSubmitEditing={() => {
                                                                setIsEditingBook(false);
                                                                setShowSuggestions(false);
                                                            }}
                                                        />
                                                        {showSuggestions && (
                                                            <View style={styles.suggestionsContainer}>
                                                                <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 150 }}>
                                                                    {isLoadingSuggestions && (
                                                                        <ActivityIndicator color={colors.primary} size="small" style={{ padding: 8 }} />
                                                                    )}
                                                                    {suggestions.map((item, index) => (
                                                                        <TouchableOpacity
                                                                            key={`${item.title}-${index}`}
                                                                            style={styles.suggestionItem}
                                                                            onPress={async () => {
                                                                                if (item.type === 'inventaire' && item.data) {
                                                                                    setIsLoadingSuggestions(true);
                                                                                    try {
                                                                                        await fetch(`${API_BASE_URL}/books/import`, {
                                                                                            method: 'POST',
                                                                                            headers: { 'Content-Type': 'application/json' },
                                                                                            body: JSON.stringify({
                                                                                                title: item.title,
                                                                                                inventaireUri: item.data.uri,
                                                                                                authors: item.data.authors || [],
                                                                                                cover: item.data.image || null,
                                                                                                description: item.data.description || '',
                                                                                            }),
                                                                                        });
                                                                                        if (item.data.authors && item.data.authors.length > 0) {
                                                                                            setEditedAuthor(item.data.authors[0]);
                                                                                        }
                                                                                    } catch (e) {
                                                                                        console.error('[ScanPreviewModal] Failed to import Inventaire book:', e);
                                                                                    }
                                                                                    setIsLoadingSuggestions(false);
                                                                                } else if (item.author) {
                                                                                    setEditedAuthor(typeof item.author === 'string' ? item.author : getAuthorName(item.author));
                                                                                }
                                                                                setEditedBook(item.title);
                                                                                setIsEditingBook(false);
                                                                                setShowSuggestions(false);
                                                                            }}
                                                                        >
                                                                            <BookIcon size={14} color={item.type === 'inventaire' ? colors.primary : colors.textTertiary} style={{ marginRight: 8 }} />
                                                                            <View style={{ flex: 1 }}>
                                                                                <Text style={styles.suggestionText} numberOfLines={1}>{item.title}</Text>
                                                                                {item.author ? (
                                                                                    <Text style={styles.suggestionAuthorText} numberOfLines={1}>
                                                                                        {getAuthorName(item.author)}
                                                                                    </Text>
                                                                                ) : null}
                                                                            </View>
                                                                        </TouchableOpacity>
                                                                    ))}
                                                                    {suggestions.length === 0 && !isLoadingSuggestions && (
                                                                        <View style={styles.suggestionItem}>
                                                                            <Text style={styles.suggestionTextMeta}>Aucun livre trouvé</Text>
                                                                        </View>
                                                                    )}
                                                                </ScrollView>
                                                            </View>
                                                        )}
                                                    </View>
                                                ) : isBookUnknown ? (
                                                    <TouchableOpacity
                                                        style={styles.bookPlaceholderButton}
                                                        onPress={() => {
                                                            setIsEditingBook(true);
                                                            setEditedBook(''); // Clear on click as requested
                                                            setSuggestions(initialBooks.map(b => ({ type: 'local' as const, title: b.title, author: b.author })));
                                                            setShowSuggestions(true);
                                                            // Close other dropdowns
                                                            setIsEditingAuthor(false);
                                                            setShowAuthorSuggestions(false);
                                                        }}
                                                    >
                                                        <Text style={styles.bookPlaceholderText}>Ajouter un livre</Text>
                                                    </TouchableOpacity>
                                                ) : (
                                                    <TouchableOpacity
                                                        onPress={() => {
                                                            setIsEditingBook(true);
                                                            setEditedBook(''); // Clear on click as requested
                                                            setSuggestions(initialBooks.map(b => ({ type: 'local' as const, title: b.title, author: b.author })));
                                                            setShowSuggestions(true);
                                                            // Close other dropdowns
                                                            setIsEditingAuthor(false);
                                                            setShowAuthorSuggestions(false);
                                                        }}
                                                    >
                                                        <Text style={styles.bookTitle}>{bookTitle}</Text>
                                                    </TouchableOpacity>
                                                )}
                                            </View>

                                            <View style={{ zIndex: 10, marginTop: 4 }}>
                                                {isEditingAuthor ? (
                                                    <View>
                                                        <TextInput
                                                            style={styles.authorInput}
                                                            value={editedAuthor}
                                                            autoFocus
                                                            onChangeText={handleAuthorChange}
                                                            onBlur={() => {
                                                                setTimeout(() => {
                                                                    setIsEditingAuthor(false);
                                                                    setShowAuthorSuggestions(false);
                                                                }, 200);
                                                            }}
                                                            placeholder="Nom de l'auteur"
                                                            placeholderTextColor={colors.textTertiary}
                                                            returnKeyType="done"
                                                            onSubmitEditing={() => {
                                                                setIsEditingAuthor(false);
                                                                setShowAuthorSuggestions(false);
                                                            }}
                                                        />
                                                        {showAuthorSuggestions && (
                                                            <View style={styles.suggestionsContainer}>
                                                                <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 150 }}>
                                                                    {isLoadingAuthorSuggestions && (
                                                                        <ActivityIndicator color={colors.primary} size="small" style={{ padding: 8 }} />
                                                                    )}
                                                                    {authorSuggestions.map((item, index) => (
                                                                        <TouchableOpacity
                                                                            key={`${item.name}-${index}`}
                                                                            style={styles.suggestionItem}
                                                                            onPress={() => {
                                                                                setEditedAuthor(item.name);
                                                                                setIsEditingAuthor(false);
                                                                                setShowAuthorSuggestions(false);
                                                                            }}
                                                                        >
                                                                            <UserIcon size={14} color={item.type === 'inventaire' ? colors.primary : colors.textTertiary} style={{ marginRight: 8 }} />
                                                                            <Text style={styles.suggestionText} numberOfLines={1}>{item.name}</Text>
                                                                        </TouchableOpacity>
                                                                    ))}
                                                                    {authorSuggestions.length === 0 && !isLoadingAuthorSuggestions && (
                                                                        <View style={styles.suggestionItem}>
                                                                            <Text style={styles.suggestionTextMeta}>Aucun auteur trouvé</Text>
                                                                        </View>
                                                                    )}
                                                                </ScrollView>
                                                            </View>
                                                        )}
                                                    </View>
                                                ) : isAuthorUnknown ? (
                                                    <TouchableOpacity
                                                        style={styles.authorPlaceholderButton}
                                                        onPress={() => {
                                                            setIsEditingAuthor(true);
                                                            setEditedAuthor(''); // Clear on click as requested
                                                            setAuthorSuggestions(initialAuthors);
                                                            setShowAuthorSuggestions(true);
                                                            // Close other dropdowns
                                                            setIsEditingBook(false);
                                                            setShowSuggestions(false);
                                                        }}
                                                    >
                                                        <Text style={styles.authorPlaceholderText}>Ajouter un auteur</Text>
                                                    </TouchableOpacity>
                                                ) : (
                                                    <TouchableOpacity
                                                        onPress={() => {
                                                            setIsEditingAuthor(true);
                                                            setEditedAuthor(''); // Clear on click as requested
                                                            setAuthorSuggestions(initialAuthors);
                                                            setShowAuthorSuggestions(true);
                                                            // Close other dropdowns
                                                            setIsEditingBook(false);
                                                            setShowSuggestions(false);
                                                        }}
                                                    >
                                                        <Text style={styles.authorName}>{authorName}</Text>
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        </View>
                                        <Text style={styles.dateText}>
                                            {new Date().toLocaleDateString('fr-FR', {
                                                day: '2-digit',
                                                month: 'short',
                                            })}
                                        </Text>
                                    </View>

                                    <View style={styles.actions}>
                                        <View style={styles.actionButton}>
                                            <Heart size={20} color={colors.textTertiary} fill="none" />
                                            <Text style={styles.actionText}>0</Text>
                                        </View>
                                        <View style={styles.actionButton}>
                                            <Share2 size={20} color={colors.textTertiary} />
                                            <Text style={styles.actionText}>Partager</Text>
                                        </View>
                                    </View>
                                </View>
                            </ScrollView>

                            <View style={styles.previewActions}>
                                <TouchableOpacity
                                    style={styles.previewCancelButton}
                                    onPress={onClose}
                                >
                                    <Text style={styles.previewCancelButtonText}>Annuler</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.previewConfirmButton, isSubmitting && { opacity: 0.7 }]}
                                    onPress={handleConfirm}
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <ActivityIndicator color="#000" size="small" />
                                    ) : (
                                        <Text style={styles.previewConfirmButtonText}>Confirmer</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </Pressable>
                    </Pressable>
                </KeyboardAvoidingView>
                {showConfetti && visible && (
                    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
                        <CannonConfetti
                            ref={cannonConfettiRef}
                            autoplay={false}
                            gravity={3}
                            infinite={false}
                            colors={['#20B8CD', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#3B82F6']}
                            onAnimationEnd={() => cannonConfettiRef.current?.reset()}
                            containerStyle={StyleSheet.absoluteFillObject}
                        >
                            <CannonConfetti.Origin
                                position="bottom-left"
                                count={100}
                                initialSpeed={3}
                                spread={Math.PI / 4}
                            >
                                <CannonConfetti.Flake size={12} radius={6} />
                            </CannonConfetti.Origin>

                            <CannonConfetti.Origin
                                position="bottom-center"
                                count={100}
                                initialSpeed={4}
                                spread={Math.PI / 3}
                            >
                                <CannonConfetti.Flake size={10} />
                            </CannonConfetti.Origin>

                            <CannonConfetti.Origin
                                position="bottom-right"
                                count={100}
                                initialSpeed={3}
                                spread={Math.PI / 4}
                            >
                                <CannonConfetti.Flake size={14} radius={4} />
                            </CannonConfetti.Origin>
                        </CannonConfetti>
                    </View>
                )}
            </View>
        </Modal >
    );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    previewBackdrop: {
        flex: 1,
        backgroundColor: colors.backdrop,
        justifyContent: 'center',
        alignItems: 'center',
    },
    previewContainer: {
        width: '90%',
        maxHeight: '80%',
        backgroundColor: colors.background,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
    },
    previewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    previewTitle: {
        fontSize: 18,
        color: colors.text,
        fontWeight: '600',
    },
    previewScrollView: {
        maxHeight: 400,
    },
    previewQuoteCard: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.surfaceHighlight,
        borderRadius: 16,
        padding: 20,
        margin: 16,
        minHeight: 250, // Increased min height to accommodate dropdowns
    },
    quoteIcon: {
        marginBottom: 8,
    },
    previewQuoteText: {
        fontSize: 18,
        lineHeight: 28,
        color: colors.text,
        marginBottom: 16,
        fontFamily: 'Times New Roman',
        fontStyle: 'italic',
        fontWeight: '100',
    },
    previewQuoteInput: {
        fontSize: 18,
        lineHeight: 28,
        color: colors.text,
        marginBottom: 16,
        fontFamily: 'Times New Roman',
        fontStyle: 'italic',
        backgroundColor: colors.inputBackground,
        borderRadius: 6,
        padding: 0,
    },
    previewBookInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: colors.surfaceHighlight,
        zIndex: 100, // Ensure dropdowns appear on top
    },
    bookInfoLeft: {
        flex: 1,
        marginRight: 16,
    },
    bookTitle: {
        fontSize: 14,
        color: colors.primary,
        marginBottom: 4,
        paddingHorizontal: 0,
    },
    bookTitleInput: {
        fontSize: 14,
        color: colors.primary,
        backgroundColor: colors.inputBackground,
        borderRadius: 6,
        paddingHorizontal: 0,
        paddingVertical: 8,
        marginBottom: 4,
    },
    bookPlaceholderButton: {
        borderWidth: 0,
        borderRadius: 6,
        paddingHorizontal: 0,
        paddingVertical: 8,
        backgroundColor: colors.inputBackground,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    bookPlaceholderText: {
        fontSize: 14,
        color: colors.primary,
    },
    authorName: {
        fontSize: 12,
        color: colors.textSecondary,
        paddingHorizontal: 0,
    },
    authorInput: {
        fontSize: 12,
        color: colors.textSecondary,
        backgroundColor: colors.inputBackground,
        borderRadius: 6,
        paddingHorizontal: 0,
        paddingVertical: 8,
    },
    authorPlaceholderButton: {
        borderWidth: 0,
        borderRadius: 6,
        paddingHorizontal: 0,
        paddingVertical: 8,
        backgroundColor: colors.inputBackground,
        flexDirection: 'row',
        alignItems: 'center',
    },
    authorPlaceholderText: {
        fontSize: 12,
        color: colors.textSecondary,
    },
    dateText: {
        fontSize: 12,
        color: colors.textTertiary,
    },
    actions: {
        flexDirection: 'row',
        gap: 16,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    actionText: {
        fontSize: 14,
        color: colors.textTertiary,
    },
    previewActions: {
        flexDirection: 'row',
        gap: 12,
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    previewCancelButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.surfaceHighlight,
        alignItems: 'center',
    },
    previewCancelButtonText: {
        color: colors.textSecondary,
        fontSize: 16,
        fontWeight: '600',
    },
    previewConfirmButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: colors.primary,
        alignItems: 'center',
    },
    previewConfirmButtonText: {
        color: '#000', // Assuming primary text color
        fontSize: 16,
        fontWeight: 'bold',
    },
    suggestionsContainer: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        backgroundColor: colors.surface,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: colors.border,
        maxHeight: 150,
        zIndex: 1000,
        elevation: 5,
        marginTop: 2,
    },
    suggestionItem: {
        padding: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.surfaceHighlight,
        flexDirection: 'row',
        alignItems: 'center',
    },
    suggestionText: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '500',
    },
    suggestionAuthorText: {
        color: colors.textTertiary,
        fontSize: 11,
        marginTop: 1,
    },
    suggestionTextMeta: {
        color: colors.textTertiary,
        fontSize: 12,
        fontStyle: 'italic',
    }
});
