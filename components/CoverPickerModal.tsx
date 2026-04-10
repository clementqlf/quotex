import React, { useState, useRef, useCallback } from 'react';
import {
    Modal,
    View,
    Text,
    Image,
    TouchableOpacity,
    FlatList,
    StyleSheet,
    ActivityIndicator,
    Dimensions,
    StatusBar,
} from 'react-native';
import { X, Check, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { API_BASE_URL } from '../src/config/api';
import { Book } from '../types';

interface CoverOption {
    label: string;
    url: string;
}

interface Props {
    visible: boolean;
    book: Book;
    onClose: () => void;
    onCoverSelected: (url: string) => void;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const COVER_W = SCREEN_W * 0.62;
const COVER_H = COVER_W * 1.52;

function buildCoverOptions(book: Book): CoverOption[] {
    const options: CoverOption[] = [];

    // 1. Current stored cover (Google Books thumbnail)
    if (book.cover) {
        options.push({ label: 'Google Books', url: book.cover });
    }

    // 2. Google Books — higher resolution zoom
    if (book.googleId) {
        const base = `https://books.google.com/books/content?id=${book.googleId}&printsec=frontcover&img=1`;
        const zoom2 = `${base}&zoom=2`;
        if (zoom2 !== book.cover) {
            options.push({ label: 'Google Books (HD)', url: zoom2 });
        }
    }

    // 3. OpenLibrary by ISBN
    if (book.isbn) {
        options.push({
            label: 'OpenLibrary',
            url: `https://covers.openlibrary.org/b/isbn/${book.isbn}-L.jpg`,
        });
    }

    // 4. OpenLibrary by Work key
    if (book.openLibraryId) {
        const workId = book.openLibraryId.replace('/works/', '');
        options.push({
            label: 'OpenLibrary (OL)',
            url: `https://covers.openlibrary.org/b/olid/${workId}-L.jpg`,
        });
    }

    // Deduplicate by URL
    const seen = new Set<string>();
    return options.filter(opt => {
        if (!opt.url || seen.has(opt.url)) return false;
        seen.add(opt.url);
        return true;
    });
}

export default function CoverPickerModal({ visible, book, onClose, onCoverSelected }: Props) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());
    const flatListRef = useRef<FlatList>(null);

    const allCovers = buildCoverOptions(book);
    // Filter out failed images (but keep at least the list intact until confirmed failed)
    const covers = allCovers.filter(c => !failedUrls.has(c.url));

    const currentCover = covers[currentIndex];
    const isCurrentSaved = currentCover?.url === book.cover;

    const handleApply = async () => {
        if (!currentCover || isCurrentSaved) {
            onClose();
            return;
        }
        setIsSaving(true);
        try {
            const response = await fetch(`${API_BASE_URL}/books/${book.id}/cover`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cover: currentCover.url }),
            });
            if (response.ok) {
                onCoverSelected(currentCover.url);
                onClose();
            }
        } catch (e) {
            console.error('Error saving cover:', e);
        } finally {
            setIsSaving(false);
        }
    };

    const goTo = (index: number) => {
        if (index < 0 || index >= covers.length) return;
        flatListRef.current?.scrollToIndex({ index, animated: true });
        setCurrentIndex(index);
    };

    const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
        if (viewableItems.length > 0) {
            setCurrentIndex(viewableItems[0].index ?? 0);
        }
    }, []);

    const renderItem = ({ item }: { item: CoverOption }) => (
        <View style={styles.slide}>
            <Image
                source={{ uri: item.url }}
                style={styles.coverImage}
                resizeMode="contain"
                onError={() => setFailedUrls(prev => new Set(prev).add(item.url))}
            />
        </View>
    );

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent
            statusBarTranslucent
            onRequestClose={onClose}
        >
            <View style={styles.backdrop}>
                {/* Close button */}
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                    <X size={22} color="#fff" />
                </TouchableOpacity>

                {/* Title */}
                <Text style={styles.title}>
                    {book.title}
                </Text>

                {/* Carousel */}
                <View style={styles.carouselArea}>
                    {/* Left arrow */}
                    {currentIndex > 0 && (
                        <TouchableOpacity style={[styles.arrow, styles.arrowLeft]} onPress={() => goTo(currentIndex - 1)}>
                            <ChevronLeft size={28} color="#fff" />
                        </TouchableOpacity>
                    )}

                    <FlatList
                        ref={flatListRef}
                        data={covers}
                        renderItem={renderItem}
                        keyExtractor={(item) => item.url}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        onViewableItemsChanged={onViewableItemsChanged}
                        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
                        getItemLayout={(_, index) => ({
                            length: SCREEN_W,
                            offset: SCREEN_W * index,
                            index,
                        })}
                        style={styles.flatList}
                    />

                    {/* Right arrow */}
                    {currentIndex < covers.length - 1 && (
                        <TouchableOpacity style={[styles.arrow, styles.arrowRight]} onPress={() => goTo(currentIndex + 1)}>
                            <ChevronRight size={28} color="#fff" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Source label + page dots */}
                <View style={styles.metaRow}>
                    <Text style={styles.sourceLabel}>
                        {currentCover?.label || ''}
                    </Text>
                    <View style={styles.dotsRow}>
                        {covers.map((_, i) => (
                            <TouchableOpacity key={i} onPress={() => goTo(i)}>
                                <View style={[styles.dot, i === currentIndex && styles.dotActive]} />
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Action button */}
                <View style={styles.footer}>
                    {isCurrentSaved ? (
                        <View style={styles.savedBadge}>
                            <Check size={16} color="#fff" strokeWidth={3} />
                            <Text style={styles.savedText}>Couverture actuelle</Text>
                        </View>
                    ) : (
                        <TouchableOpacity
                            style={[styles.applyButton, isSaving && { opacity: 0.7 }]}
                            onPress={handleApply}
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <Check size={18} color="#fff" strokeWidth={2.5} />
                                    <Text style={styles.applyText}>Choisir cette couverture</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const PRIMARY = '#20B8CD';

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.93)',
        alignItems: 'center',
        paddingTop: 56,
        paddingBottom: 40,
    },
    closeButton: {
        position: 'absolute',
        top: 52,
        right: 20,
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 24,
        paddingHorizontal: 60,
        textAlign: 'center',
        opacity: 0.9,
    },
    carouselArea: {
        width: SCREEN_W,
        flex: 1,
        justifyContent: 'center',
        position: 'relative',
    },
    flatList: {
        flex: 1,
    },
    slide: {
        width: SCREEN_W,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    coverImage: {
        width: COVER_W,
        height: COVER_H,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.6,
        shadowRadius: 16,
    },
    arrow: {
        position: 'absolute',
        top: '50%',
        marginTop: -24,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 5,
    },
    arrowLeft: {
        left: 12,
    },
    arrowRight: {
        right: 12,
    },
    metaRow: {
        alignItems: 'center',
        gap: 12,
        marginTop: 20,
        marginBottom: 8,
    },
    sourceLabel: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.55)',
        letterSpacing: 0.3,
    },
    dotsRow: {
        flexDirection: 'row',
        gap: 6,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(255,255,255,0.25)',
    },
    dotActive: {
        backgroundColor: PRIMARY,
        width: 18,
    },
    footer: {
        marginTop: 16,
        paddingHorizontal: 24,
        width: '100%',
        alignItems: 'center',
    },
    savedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    savedText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 15,
        fontWeight: '500',
    },
    applyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        paddingVertical: 15,
        borderRadius: 14,
        backgroundColor: PRIMARY,
        justifyContent: 'center',
    },
    applyText: {
        fontSize: 16,
        color: '#fff',
        fontWeight: '700',
    },
});
