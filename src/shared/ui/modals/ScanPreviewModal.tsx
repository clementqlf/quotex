import { useTheme } from '@/src/app/providers/ThemeContext';
import { useAuthor } from '@/src/entities/author/providers/AuthorProvider';
import { resolveAndImportBook } from '@/src/entities/book/lib/BookResolutionService';
import { useQuote } from '@/src/entities/quote/providers/QuoteProvider';
import { bookDescriptions, localQuotesDB } from '@/src/shared/api/staticData';
import { getAuthorName, getBookTitle } from '@/src/shared/lib/dataHelpers';
import { ThemeColors } from '@/src/shared/theme';
import { Book as BookIcon, Heart, Share2, User as UserIcon, X } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { searchServer } from '@/src/features/search/lib/useSearch';
import { isOffline } from '@/src/shared/lib/offline/networkUtils';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import {
  CannonConfetti,
  type CannonConfettiMethods
} from 'react-native-fast-confetti';
import Svg, { Path } from 'react-native-svg';

export type ScanPreviewModalProps = {
    visible: boolean;
    onClose: () => void;
    onConfirm: (quote: string, book: string, author: string) => void | Promise<void>;
    scannedText: string;
    initialBook?: string;
    initialAuthor?: string;
    showConfetti?: boolean;
    confirmButtonText?: string;
};

const emptySearchResults = { books: [], inventaireWorks: [], authors: [], inventaireAuthors: [] };

export default function ScanPreviewModal({
    visible,
    onClose,
    onConfirm,
    scannedText,
    initialBook = '',
    initialAuthor = '',
    showConfetti = false,
    confirmButtonText = 'Confirmer',
}: ScanPreviewModalProps) {
    const { quotes } = useQuote();
    const { getBookById, getBookByTitle, getBookByInventaireUri, importBook, getAuthorByName } = useAuthor();
    const { colors } = useTheme();
    const styles = createStyles(colors);
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
    const [searchSuggestions, setSearchSuggestions] = useState<SuggestionItem[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

    // State for Author Suggestions
    type AuthorSuggestionItem = { type: 'local' | 'database' | 'inventaire'; name: string; data?: any };
    const [searchAuthorSuggestions, setSearchAuthorSuggestions] = useState<AuthorSuggestionItem[]>([]);
    const [showAuthorSuggestions, setShowAuthorSuggestions] = useState(false);
    const [isLoadingAuthorSuggestions, setIsLoadingAuthorSuggestions] = useState(false);

    // Sync state during render when modal opens or props change
    const [prevVisible, setPrevVisible] = useState(visible);
    const [prevScannedText, setPrevScannedText] = useState(scannedText);
    const [prevInitialBook, setPrevInitialBook] = useState(initialBook);
    const [prevInitialAuthor, setPrevInitialAuthor] = useState(initialAuthor);

    if (visible !== prevVisible || scannedText !== prevScannedText || initialBook !== prevInitialBook || initialAuthor !== prevInitialAuthor) {
        setPrevVisible(visible);
        setPrevScannedText(scannedText);
        setPrevInitialBook(initialBook);
        setPrevInitialAuthor(initialAuthor);

        if (visible) {
            setIsSubmitting(false);
            setEditedQuote('');
            setEditedBook(initialBook);
            setEditedAuthor(initialAuthor);
            setIsEditingBook(false);
            setIsEditingAuthor(false);
            setIsEditingQuote(!scannedText);
            setShowSuggestions(false);
            setShowAuthorSuggestions(false);
        }
    }

    // Initial books from local data (quotes)
    const initialBooks = useMemo(() => {
        const bookMap = new Map<string, string>(); // title -> author
        quotes.forEach(q => {
            if (q.book) {
                const title = getBookTitle(q.book);
                const author = getAuthorName(q.author);
                if (title && title !== 'Livre inconnu' && !bookMap.has(title)) {
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
                const name = getAuthorName(q.author);
                if (name && name !== 'Auteur inconnu') {
                    authors.add(name);
                }
            }
        });
        return Array.from(authors).map(name => ({ type: 'local' as const, name }));
    }, [quotes]);

    // Derived suggestions based on current inputs
    const displaySuggestions = useMemo(() => {
        if (!editedBook.trim()) {
            return initialBooks.map(b => ({ type: 'local' as const, title: b.title, author: b.author }));
        }
        if (editedBook.trim().length < 3) {
            return initialBooks
                .filter(b => b.title.toLowerCase().includes(editedBook.toLowerCase()))
                .map(b => ({ type: 'local' as const, title: b.title, author: b.author }));
        }
        return searchSuggestions;
    }, [editedBook, searchSuggestions, initialBooks]);

    const displayAuthorSuggestions = useMemo(() => {
        if (!editedAuthor.trim()) {
            return initialAuthors;
        }
        if (editedAuthor.trim().length < 3) {
            return initialAuthors.filter(a => a.name.toLowerCase().includes(editedAuthor.toLowerCase()));
        }
        return searchAuthorSuggestions;
    }, [editedAuthor, searchAuthorSuggestions, initialAuthors]);

    useEffect(() => {
        if (visible && showConfetti) {
            cannonConfettiRef.current?.restart();
        }
    }, [visible, showConfetti]);

    const resolveBookTitle = () => {
        if (editedBook.trim()) return editedBook.trim();
        if (initialBook && initialBook !== 'Livre inconnu') return initialBook;

        // Try to match from static database
        const staticMatch = Object.keys(bookDescriptions).find((title) =>
            (localQuotesDB || []).some((q) => q.text === scannedText && q.book === title)
        );
        if (staticMatch) return staticMatch;

        // Or from the user's active quotes list
        const userMatch = quotes.find((q) => q.text === scannedText);
        if (userMatch && userMatch.book) {
            return getBookTitle(userMatch.book);
        }

        return '';
    };

    const resolveAuthorName = () => {
        if (editedAuthor.trim()) return editedAuthor.trim();
        if (initialAuthor && initialAuthor !== 'Auteur inconnu' && !editedBook.trim()) return initialAuthor;

        const bookTitle = resolveBookTitle();
        if (initialBook && initialBook !== 'Livre inconnu' && bookTitle === initialBook && initialAuthor && initialAuthor !== 'Auteur inconnu') return initialAuthor;

        // Try to get author from bookDescriptions
        if (bookDescriptions[bookTitle]?.author) {
            return bookDescriptions[bookTitle].author;
        }

        // Or search the user's active quotes for a quote from this book
        if (bookTitle) {
            const sameBookQuote = quotes.find(q => getBookTitle(q.book) === bookTitle);
            if (sameBookQuote && sameBookQuote.author) {
                return getAuthorName(sameBookQuote.author);
            }
        }

        return '';
    };

    const saveQuote = async (book: string, author: string) => {
        const finalText = editedQuote.trim() || scannedText;
        console.log('[ScanPreviewModal] saveQuote called, finalText:', finalText);

        if (!finalText) {
            console.log('[ScanPreviewModal] No text to save, returning');
            return;
        }

        setIsSubmitting(true);
        try {
            console.log('[ScanPreviewModal] Calling onConfirm...');
            await onConfirm(finalText, book, author);
            console.log('[ScanPreviewModal] onConfirm completed successfully');
        } catch (error) {
            console.error("[ScanPreviewModal] Error confirming quote:", error);
        } finally {
            console.log('[ScanPreviewModal] Setting isSubmitting to false');
            setIsSubmitting(false);
        }
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

        const finalBook = editedBook.trim() || resolveBookTitle();
        const finalAuthor = editedAuthor.trim() || resolveAuthorName();
        console.log('[ScanPreviewModal] finalBook:', finalBook);
        console.log('[ScanPreviewModal] finalAuthor:', finalAuthor);

        const isBookEmpty = !finalBook || finalBook === 'Livre inconnu' || finalBook.toLowerCase().startsWith('unknown');
        const isAuthorEmpty = !finalAuthor || finalAuthor === 'Auteur inconnu' || finalAuthor.toLowerCase().startsWith('unknown');

        if (isBookEmpty || isAuthorEmpty) {
            Alert.alert(
                "Informations manquantes",
                "Associer un auteur et un livre permet d'organiser et de retrouver vos citations facilement. Souhaitez-vous les ajouter maintenant ?",
                [
                    {
                        text: "Enregistrer quand même",
                        onPress: () => saveQuote(finalBook, finalAuthor),
                        style: "destructive"
                    },
                    {
                        text: "Ajouter les infos",
                        onPress: () => {
                            if (isBookEmpty) {
                                setIsEditingBook(true);
                                setShowSuggestions(true);
                            } else {
                                setIsEditingAuthor(true);
                                setShowAuthorSuggestions(true);
                            }
                        },
                        style: "cancel"
                    }
                ]
            );
            return;
        }

        await saveQuote(finalBook, finalAuthor);
    };

    const handleBookChange = (text: string) => {
        setEditedBook(text);
        if (!text.trim()) {
            setShowSuggestions(true);
        }
    };

    // Debounced Book Search
    useEffect(() => {
        if (!isEditingBook || !editedBook.trim() || editedBook.trim().length < 3) {
            return;
        }

        const timer = setTimeout(async () => {
            setIsLoadingSuggestions(true);
            try {
                // Utiliser searchServer pour la recherche
                const results = await isOffline() ? emptySearchResults : await searchServer(editedBook).catch(() => emptySearchResults);

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

                const scoreItem = (item: SuggestionItem) =>
                    (item.data?.image || item.data?.cover ? 4 : 0) +
                    (item.data?.description ? 2 : 0) +
                    (item.data?.pages ? 1 : 0);

                const mergedMap = new Map<string, SuggestionItem>();

                [...dbItems, ...localMatches, ...inventaireItems].forEach(item => {
                    const key = item.title.trim().toLowerCase();
                    const existing = mergedMap.get(key);
                    if (!existing) {
                        mergedMap.set(key, { ...item });
                    } else {
                        // Merge missing properties from the alternative edition/item
                        if (!existing.author && item.author) existing.author = item.author;
                        if (!existing.data?.description && item.data?.description) {
                            existing.data = { ...existing.data, description: item.data.description };
                        }
                        if (!existing.data?.image && item.data?.image) {
                            existing.data = { ...existing.data, image: item.data.image };
                        }
                        if (!existing.data?.cover && item.data?.cover) {
                            existing.data = { ...existing.data, cover: item.data.cover };
                        }
                        if (!existing.data?.uri && item.data?.uri) {
                            existing.data = { ...existing.data, uri: item.data.uri };
                        }

                        // If the new item has a higher overall metadata richness score, prefer it as the base
                        if (scoreItem(item) > scoreItem(existing)) {
                            mergedMap.set(key, {
                                ...item,
                                author: item.author || existing.author,
                                data: {
                                    ...item.data,
                                    description: item.data?.description || existing.data?.description,
                                    image: item.data?.image || existing.data?.image || item.data?.cover || existing.data?.cover,
                                    cover: item.data?.cover || existing.data?.cover || item.data?.image || existing.data?.image,
                                    uri: item.data?.uri || existing.data?.uri,
                                }
                            });
                        }
                    }
                });

                setSearchSuggestions(Array.from(mergedMap.values()));
            } catch (error) {
                console.error("Error searching books", error);
            } finally {
                setIsLoadingSuggestions(false);
            }
        }, 500); // 500ms debounce

        return () => clearTimeout(timer);
    }, [editedBook, isEditingBook, initialBooks]);

    const handleAuthorChange = (text: string) => {
        setEditedAuthor(text);
        if (!text.trim()) {
            setShowAuthorSuggestions(true);
        }
    };

    // Debounced Author Search
    useEffect(() => {
        if (!isEditingAuthor || !editedAuthor.trim() || editedAuthor.trim().length < 3) {
            return;
        }

        const timer = setTimeout(async () => {
            setIsLoadingAuthorSuggestions(true);
            try {
                const results = await isOffline() ? emptySearchResults : await searchServer(editedAuthor).catch(() => emptySearchResults);

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

                setSearchAuthorSuggestions(combined);
            } catch (error) {
                console.error("Error searching authors", error);
            } finally {
                setIsLoadingAuthorSuggestions(false);
            }
        }, 500); // 500ms debounce

        return () => clearTimeout(timer);
    }, [editedAuthor, isEditingAuthor, initialAuthors]);

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
                                            accessible={true}
                                            accessibilityLabel="Texte de la citation"
                                            testID="quote-input"
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
                                                            accessible={true}
                                                            accessibilityLabel="Titre du livre"
                                                            testID="book-input"
                                                        />
                                                        {showSuggestions && (
                                                            <View style={styles.suggestionsContainer}>
                                                                <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 150 }}>
                                                                    {isLoadingSuggestions && (
                                                                        <ActivityIndicator color={colors.primary} size="small" style={{ padding: 8 }} />
                                                                    )}
                                                                    {displaySuggestions.map((item, index) => {
                                                                         const sItem = item as SuggestionItem;
                                                                         return (
                                                                             <TouchableOpacity
                                                                                 key={`${item.title}-${index}`}
                                                                                 style={styles.suggestionItem}
                                                                                 onPress={async () => {
                                                                                     setIsLoadingSuggestions(true);
                                                                                     try {
                                                                                         const resolved = await resolveAndImportBook(
                                                                                             {
                                                                                                 title: item.title,
                                                                                                 author: typeof item.author === 'string' ? item.author : undefined,
                                                                                                 inventaireUri: sItem.data?.uri || sItem.data?.inventaireUri,
                                                                                                 cover: sItem.data?.image || sItem.data?.cover,
                                                                                                 bookData: sItem.data,
                                                                                             },
                                                                                             {
                                                                                                 getBookById,
                                                                                                 getBookByTitle,
                                                                                                 getBookByInventaireUri,
                                                                                                 importBook,
                                                                                                 getAuthorByName,
                                                                                             }
                                                                                         );
                                                                                         const isValidAuthorName = (name?: string | null) => {
                                                                                              if (!name) return false;
                                                                                              const low = name.trim().toLowerCase();
                                                                                              return low !== '' && low !== 'auteur inconnu' && low !== 'null' && !low.startsWith('unknown');
                                                                                         };

                                                                                         if (resolved.author?.name && isValidAuthorName(resolved.author.name)) {
                                                                                             setEditedAuthor(resolved.author.name);
                                                                                         } else if (sItem.data?.authors && sItem.data.authors.length > 0 && isValidAuthorName(sItem.data.authors[0])) {
                                                                                             setEditedAuthor(sItem.data.authors[0]);
                                                                                         } else if (item.author) {
                                                                                             const rawAuthor = typeof item.author === 'string' ? item.author : getAuthorName(item.author);
                                                                                             if (isValidAuthorName(rawAuthor)) {
                                                                                                 setEditedAuthor(rawAuthor);
                                                                                             }
                                                                                         }
                                                                                     } catch (e) {
                                                                                         console.error('[ScanPreviewModal] Failed to resolve and import book:', e);
                                                                                     } finally {
                                                                                         setIsLoadingSuggestions(false);
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
                                                                         );
                                                                     })}
                                                                </ScrollView>
                                                            </View>
                                                        )}
                                                    </View>
                                                ) : isBookUnknown ? (
                                                    <TouchableOpacity
                                                        style={styles.bookPlaceholderButton}
                                                        onPress={() => {
                                                            setIsEditingBook(true);
                                                            setEditedBook('');
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
                                                            setEditedBook(bookTitle);
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
                                                            accessible={true}
                                                            accessibilityLabel="Nom de l'auteur"
                                                            testID="author-input"
                                                        />
                                                        {showAuthorSuggestions && (
                                                            <View style={styles.suggestionsContainer}>
                                                                <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 150 }}>
                                                                    {isLoadingAuthorSuggestions && (
                                                                        <ActivityIndicator color={colors.primary} size="small" style={{ padding: 8 }} />
                                                                    )}
                                                                    {displayAuthorSuggestions.map((item, index) => (
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

                                                                </ScrollView>
                                                            </View>
                                                        )}
                                                    </View>
                                                ) : isAuthorUnknown ? (
                                                    <TouchableOpacity
                                                        style={styles.authorPlaceholderButton}
                                                        onPress={() => {
                                                            setIsEditingAuthor(true);
                                                            setEditedAuthor('');
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
                                                            setEditedAuthor(authorName);
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
                                    accessible={true}
                                    accessibilityLabel={confirmButtonText === 'Enregistrer' ? 'Enregistrer la citation dans ma collection' : 'Confirmer et enregistrer la citation'}
                                    accessibilityRole="button"
                                    testID="save-button"
                                >
                                    {isSubmitting ? (
                                        <ActivityIndicator color="#000" size="small" />
                                    ) : (
                                        <Text style={styles.previewConfirmButtonText}>{confirmButtonText}</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </Pressable>
                    </Pressable>
                </KeyboardAvoidingView>
                {showConfetti && visible && (
                    <View style={StyleSheet.absoluteFill} pointerEvents="none">
                        <CannonConfetti
                            ref={cannonConfettiRef}
                            autoplay={false}
                            gravity={3}
                            colors={['#20B8CD', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#3B82F6']}
                            onAnimationEnd={() => cannonConfettiRef.current?.reset()}
                        >
                            <CannonConfetti.Origin
                                position="bottom-left"
                                count={150}
                                initialSpeed={3}
                            >
                                <CannonConfetti.Flake size={12} radius={6} />
                            </CannonConfetti.Origin>
                            <CannonConfetti.Origin
                                position="bottom-right"
                                count={150}
                                initialSpeed={3}
                            >
                                <CannonConfetti.Flake size={12} />
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
