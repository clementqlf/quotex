import React, { useEffect, useState } from 'react';
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Heart, Share2, X } from 'lucide-react-native';
import { bookDescriptions, localQuotesDB } from '../data/staticData';

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
    const [isEditingBook, setIsEditingBook] = useState(false);
    const [isEditingAuthor, setIsEditingAuthor] = useState(false);
    const [isEditingQuote, setIsEditingQuote] = useState(false);
    const [editedBook, setEditedBook] = useState('');
    const [editedAuthor, setEditedAuthor] = useState('');
    const [editedQuote, setEditedQuote] = useState('');

    // Reset state when modal opens or scannedText changes
    useEffect(() => {
        if (visible) {
            setEditedQuote('');
            setEditedBook('');
            setEditedAuthor('');
            setIsEditingBook(false);
            setIsEditingAuthor(false);
            setIsEditingQuote(!scannedText);
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

        const finalBook = getBookTitle();
        const finalAuthor = getAuthorName();

        onConfirm(finalText, finalBook, finalAuthor);
    };

    return (
        <Modal
            animationType="slide"
            transparent
            visible={visible}
            onRequestClose={onClose}
        >
            <Pressable style={styles.previewBackdrop} onPress={onClose}>
                <Pressable style={styles.previewContainer}>
                    <View style={styles.previewHeader}>
                        <Text style={styles.previewTitle}>Aperçu de la citation</Text>
                        <TouchableOpacity onPress={onClose}>
                            <X size={24} color="#9CA3AF" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.previewScrollView}>
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
                                    {isEditingBook ? (
                                        <TextInput
                                            style={styles.bookTitleInput}
                                            value={editedBook}
                                            defaultValue={getBookTitle()}
                                            autoFocus
                                            onChangeText={setEditedBook}
                                            onBlur={() => setIsEditingBook(false)}
                                            placeholder="Titre du livre"
                                            placeholderTextColor="#6B7280"
                                            returnKeyType="done"
                                            onSubmitEditing={() => setIsEditingBook(false)}
                                        />
                                    ) : (
                                        <TouchableOpacity
                                            onPress={() => {
                                                setIsEditingBook(true);
                                                setEditedBook(getBookTitle());
                                            }}
                                        >
                                            <Text style={styles.bookTitle}>{getBookTitle()}</Text>
                                        </TouchableOpacity>
                                    )}

                                    {isEditingAuthor ? (
                                        <TextInput
                                            style={styles.authorInput}
                                            value={editedAuthor}
                                            defaultValue={getAuthorName()}
                                            autoFocus
                                            onChangeText={setEditedAuthor}
                                            onBlur={() => setIsEditingAuthor(false)}
                                            placeholder="Nom de l'auteur"
                                            placeholderTextColor="#6B7280"
                                            returnKeyType="done"
                                            onSubmitEditing={() => setIsEditingAuthor(false)}
                                        />
                                    ) : (
                                        <TouchableOpacity
                                            onPress={() => {
                                                setIsEditingAuthor(true);
                                                setEditedAuthor(getAuthorName());
                                            }}
                                        >
                                            <Text style={styles.authorName}>{getAuthorName()}</Text>
                                        </TouchableOpacity>
                                    )}
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
    },
    bookInfoLeft: {
        flex: 1,
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
});
