import React, { useEffect, useState, useMemo } from 'react';
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
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Heart, Share2, X, Book as BookIcon, User as UserIcon } from 'lucide-react-native';
import { bookDescriptions, localQuotesDB } from '../data/staticData';
import { useData } from '../src/contexts/DataProvider';
import { searchService } from '../src/services/SearchService';
import { googleBooksService } from '../src/services/GoogleBooksService';

type ScanPreviewModalProps = {
    visible: boolean;
    onClose: () => void;
    onConfirm: (quote: string, book: string, author: string) => void;
    scannedText: string;
};

export default function ScanPreviewModal({
    visible,
    onClose,
    onConfirm,
    scannedText,
}: ScanPreviewModalProps) {
    const { quotes } = useData();

    // State for editing
    const [isEditingBook, setIsEditingBook] = useState(false);
    const [isEditingAuthor, setIsEditingAuthor] = useState(false);
    const [isEditingQuote, setIsEditingQuote] = useState(false);

    const [editedBook, setEditedBook] = useState('');
    const [editedAuthor, setEditedAuthor] = useState('');
    const [editedQuote, setEditedQuote] = useState('');

    // State for Book Suggestions
    type SuggestionItem = { type: 'local' | 'google'; title: string; data?: any };
    const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

    // State for Author Suggestions
    const [authorSuggestions, setAuthorSuggestions] = useState<string[]>([]);
    const [showAuthorSuggestions, setShowAuthorSuggestions] = useState(false);
    const [isLoadingAuthorSuggestions, setIsLoadingAuthorSuggestions] = useState(false);

    // Initial books fro local data (quotes)
    const initialBooks = useMemo(() => {
        const books = new Set<string>();
        quotes.forEach(q => {
            if (q.book) {
                if (typeof q.book === 'string') {
                    books.add(q.book);
                } else if (q.book.title) {
                    books.add(q.book.title);
                }
            }
        });
        return Array.from(books);
    }, [quotes]);

    // Initial authors from local data (quotes)
    const initialAuthors = useMemo(() => {
        const authors = new Set<string>();
        quotes.forEach(q => {
            if (q.author) {
                if (typeof q.author === 'string') {
                    authors.add(q.author);
                } else if (q.author.name) {
                    authors.add(q.author.name);
                }
            }
        });
        return Array.from(authors);
    }, [quotes]);

    // Reset state when modal opens or scannedText changes
    useEffect(() => {
        if (visible) {
            setEditedQuote('');
            setEditedBook('');
            setEditedAuthor('');
            setIsEditingBook(false);
            setIsEditingAuthor(false);
            setIsEditingQuote(!scannedText);
            setShowSuggestions(false);
            setShowAuthorSuggestions(false);
        }
    }, [visible, scannedText]);

    const getBookTitle = () => {
        if (editedBook.trim()) return editedBook.trim();
        return (
            Object.keys(bookDescriptions).find((title) =>
                localQuotesDB.some((q) => q.text === scannedText && q.book === title)
            ) || 'Livre inconnu'
        );
    };

    const getAuthorName = () => {
        if (editedAuthor.trim()) return editedAuthor.trim();
        const bookTitle = getBookTitle();
        return bookDescriptions[bookTitle]?.author || 'Auteur inconnu';
    };

    const handleConfirm = () => {
        const finalText = editedQuote.trim() || scannedText;
        if (!finalText) return;
        const finalBook = editedBook.trim() || getBookTitle();
        const finalAuthor = editedAuthor.trim() || getAuthorName();
        onConfirm(finalText, finalBook, finalAuthor);
    };

    const handleBookChange = async (text: string) => {
        setEditedBook(text);

        if (!text.trim()) {
            setSuggestions(initialBooks.map(b => ({ type: 'local', title: b })));
            return;
        }

        setIsLoadingSuggestions(true);
        try {
            // Parallel search: Local + Google
            const [localResults, googleResults] = await Promise.all([
                searchService.search(text).catch(() => ({ books: [] })),
                googleBooksService.search(text).catch(() => [])
            ]);

            const bookTitles = localResults.books ? localResults.books.map(b => b.title) : [];
            const localMatches = initialBooks.filter(b => b.toLowerCase().includes(text.toLowerCase()));

            // Local items (deduplicated)
            const uniqueLocalTitles = Array.from(new Set([...bookTitles, ...localMatches]));
            const localItems: SuggestionItem[] = uniqueLocalTitles.map(t => ({ type: 'local', title: t }));

            // Google items
            // Filter out Google results that exactly match a local title (to avoid duplicates if we already have it)?
            // Or just show them as "Google" to indicate enhanced data?
            // Let's show them.
            const googleItems: SuggestionItem[] = googleResults.map(b => ({
                type: 'google',
                title: b.title,
                data: b
            }));

            setSuggestions([...localItems, ...googleItems]);
        } catch (error) {
            console.error("Error searching books", error);
        } finally {
            setIsLoadingSuggestions(false);
        }
    };

    const handleAuthorChange = async (text: string) => {
        setEditedAuthor(text);

        if (!text.trim()) {
            setAuthorSuggestions(initialAuthors);
            return;
        }

        setIsLoadingAuthorSuggestions(true);
        try {
            const results = await searchService.search(text);
            // Search service returns authors array
            const authorNames = results.authors.map(a => a.name);
            const localMatches = initialAuthors.filter(a => a.toLowerCase().includes(text.toLowerCase()));
            const combined = Array.from(new Set([...authorNames, ...localMatches]));
            setAuthorSuggestions(combined);
        } catch (error) {
            console.error("Error searching authors", error);
        } finally {
            setIsLoadingAuthorSuggestions(false);
        }
    };

    return (
        <Modal
            animationType="slide"
            transparent
            visible={visible}
            onRequestClose={onClose}
        >
            <Pressable style={styles.previewBackdrop} onPress={onClose}>
                <Pressable style={styles.previewContainer} onPress={(e) => e.stopPropagation()}>
                    <View style={styles.previewHeader}>
                        <Text style={styles.previewTitle}>Aperçu de la citation</Text>
                        <TouchableOpacity onPress={onClose}>
                            <X size={24} color="#9CA3AF" />
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
                                    placeholder="Modifier la citation"
                                    placeholderTextColor="#6B7280"
                                    returnKeyType="done"
                                />
                            ) : (
                                <TouchableOpacity
                                    onPress={() => {
                                        setIsEditingQuote(true);
                                        setEditedQuote(editedQuote || scannedText);
                                    }}
                                >
                                    <Text style={[styles.previewQuoteText, !editedQuote && !scannedText && { color: '#6B7280', fontStyle: 'normal' }]}>
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
                                                    placeholderTextColor="#6B7280"
                                                    returnKeyType="done"
                                                    onSubmitEditing={() => {
                                                        setIsEditingBook(false);
                                                        setShowSuggestions(false);
                                                    }}
                                                />
                                                {showSuggestions && (
                                                    <View style={styles.suggestionsContainer}>
                                                        {isLoadingSuggestions && (
                                                            <ActivityIndicator color="#20B8CD" size="small" style={{ padding: 8 }} />
                                                        )}
                                                        {suggestions.map((item, index) => (
                                                            <TouchableOpacity
                                                                key={`${item.title}-${index}`}
                                                                style={styles.suggestionItem}
                                                                onPress={async () => {
                                                                    if (item.type === 'google' && item.data) {
                                                                        setIsLoadingSuggestions(true);
                                                                        await googleBooksService.importBook(item.data);
                                                                        if (item.data.authors && item.data.authors.length > 0) {
                                                                            setEditedAuthor(item.data.authors[0]);
                                                                        }
                                                                        setIsLoadingSuggestions(false);
                                                                    }
                                                                    setEditedBook(item.title);
                                                                    setIsEditingBook(false);
                                                                    setShowSuggestions(false);
                                                                }}
                                                            >
                                                                <BookIcon size={14} color={item.type === 'google' ? '#20B8CD' : '#6B7280'} style={{ marginRight: 8 }} />
                                                                <View style={{ flex: 1 }}>
                                                                    <Text style={styles.suggestionText} numberOfLines={1}>{item.title}</Text>
                                                                    {item.type === 'google' && (
                                                                        <Text style={{ fontSize: 10, color: '#20B8CD', fontStyle: 'italic' }}>Depuis Google Books</Text>
                                                                    )}
                                                                </View>
                                                            </TouchableOpacity>
                                                        ))}
                                                        {suggestions.length === 0 && !isLoadingSuggestions && (
                                                            <View style={styles.suggestionItem}>
                                                                <Text style={styles.suggestionTextMeta}>Aucun livre trouvé</Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                )}
                                            </View>
                                        ) : (
                                            <TouchableOpacity
                                                onPress={() => {
                                                    setIsEditingBook(true);
                                                    setEditedBook(''); // Clear on click as requested
                                                    setSuggestions(initialBooks.map(b => ({ type: 'local', title: b })));
                                                    setShowSuggestions(true);
                                                    // Close other dropdowns
                                                    setIsEditingAuthor(false);
                                                    setShowAuthorSuggestions(false);
                                                }}
                                            >
                                                <Text style={styles.bookTitle}>{getBookTitle()}</Text>
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
                                                    placeholderTextColor="#6B7280"
                                                    returnKeyType="done"
                                                    onSubmitEditing={() => {
                                                        setIsEditingAuthor(false);
                                                        setShowAuthorSuggestions(false);
                                                    }}
                                                />
                                                {showAuthorSuggestions && (
                                                    <View style={styles.suggestionsContainer}>
                                                        {isLoadingAuthorSuggestions && (
                                                            <ActivityIndicator color="#20B8CD" size="small" style={{ padding: 8 }} />
                                                        )}
                                                        {authorSuggestions.map((item, index) => (
                                                            <TouchableOpacity
                                                                key={`${item}-${index}`}
                                                                style={styles.suggestionItem}
                                                                onPress={() => {
                                                                    setEditedAuthor(item);
                                                                    setIsEditingAuthor(false);
                                                                    setShowAuthorSuggestions(false);
                                                                }}
                                                            >
                                                                <UserIcon size={14} color="#6B7280" style={{ marginRight: 8 }} />
                                                                <Text style={styles.suggestionText} numberOfLines={1}>{item}</Text>
                                                            </TouchableOpacity>
                                                        ))}
                                                        {authorSuggestions.length === 0 && !isLoadingAuthorSuggestions && (
                                                            <View style={styles.suggestionItem}>
                                                                <Text style={styles.suggestionTextMeta}>Aucun auteur trouvé</Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                )}
                                            </View>
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
                                                <Text style={styles.authorName}>{getAuthorName()}</Text>
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
                                    <Heart size={20} color="#6B7280" fill="none" />
                                    <Text style={styles.actionText}>0</Text>
                                </View>
                                <View style={styles.actionButton}>
                                    <Share2 size={20} color="#6B7280" />
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
                            style={styles.previewConfirmButton}
                            onPress={handleConfirm}
                        >
                            <Text style={styles.previewConfirmButtonText}>Confirmer</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    previewBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    previewContainer: {
        width: '90%',
        maxHeight: '80%',
        backgroundColor: '#0F0F0F',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#2A2A2A',
        overflow: 'hidden',
    },
    previewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1F1F1F',
    },
    previewTitle: {
        fontSize: 18,
        color: '#FFFFFF',
        fontWeight: '600',
    },
    previewScrollView: {
        maxHeight: 400,
    },
    previewQuoteCard: {
        backgroundColor: '#1A1A1A',
        borderWidth: 1,
        borderColor: '#2A2A2A',
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
        color: '#E5E7EB',
        marginBottom: 16,
        fontFamily: 'Times New Roman',
        fontStyle: 'italic',
        fontWeight: '100',
    },
    previewQuoteInput: {
        fontSize: 18,
        lineHeight: 28,
        color: '#FFFFFF',
        marginBottom: 16,
        backgroundColor: '#222',
        borderRadius: 6,
        padding: 10,
    },
    previewBookInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#2A2A2A',
        zIndex: 100, // Ensure dropdowns appear on top
    },
    bookInfoLeft: {
        flex: 1,
        marginRight: 16,
    },
    bookTitle: {
        fontSize: 14,
        color: '#20B8CD',
        marginBottom: 4,
    },
    bookTitleInput: {
        fontSize: 14,
        color: '#20B8CD',
        backgroundColor: '#222',
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 8,
        marginBottom: 4,
    },
    authorName: {
        fontSize: 12,
        color: '#6B7280',
    },
    authorInput: {
        fontSize: 12,
        color: '#6B7280',
        backgroundColor: '#222',
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 8,
    },
    dateText: {
        fontSize: 12,
        color: '#6B7280',
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
        color: '#6B7280',
    },
    previewActions: {
        flexDirection: 'row',
        gap: 12,
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#1F1F1F',
    },
    previewCancelButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#1A1A1A',
        borderWidth: 1,
        borderColor: '#2A2A2A',
        alignItems: 'center',
    },
    previewCancelButtonText: {
        color: '#9CA3AF',
        fontSize: 16,
        fontWeight: '600',
    },
    previewConfirmButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#20B8CD',
        alignItems: 'center',
    },
    previewConfirmButtonText: {
        color: '#0F0F0F',
        fontSize: 16,
        fontWeight: 'bold',
    },
    suggestionsContainer: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        backgroundColor: '#222',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#333',
        maxHeight: 150,
        zIndex: 1000,
        elevation: 5,
        marginTop: 2,
    },
    suggestionItem: {
        padding: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#2A2A2A',
        flexDirection: 'row',
        alignItems: 'center',
    },
    suggestionText: {
        color: '#E5E7EB',
        fontSize: 14,
    },
    suggestionTextMeta: {
        color: '#6B7280',
        fontSize: 12,
        fontStyle: 'italic',
    }
});
