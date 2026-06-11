import { useTheme } from '@/src/app/providers/ThemeContext';
import { ThemeColors } from '@/src/shared/theme';
import { Check, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface WordSelectionModalProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: (selectedWords: string[]) => void;
    quoteText: string;
}

export default function WordSelectionModal({ visible, onClose, onConfirm, quoteText }: WordSelectionModalProps) {
    const { colors } = useTheme();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const [words, setWords] = useState<{ id: number; text: string; selected: boolean }[]>([]);

    useEffect(() => {
        if (quoteText) {
            // Split by spaces but keep punctuation attached to words for display, 
            // though for now we might want to just split by whitespace and strip punctuation for the actual "word" value if needed.
            // A simple split by space is a good start. 
            // To make it cleaner, we can split by regex to separate punctuation, but let's stick to simple space splitting 
            // and maybe strip punctuation when selecting.
            const wordArray = quoteText.split(/\s+/).map((word, index) => ({
                id: index,
                text: word,
                selected: false,
            }));
            setWords(wordArray);
        }
    }, [quoteText]);

    const toggleWord = (id: number) => {
        setWords(currentWords =>
            currentWords.map(w =>
                w.id === id ? { ...w, selected: !w.selected } : w
            )
        );
    };

    const handleConfirm = () => {
        const selectedWords = words
            .filter(w => w.selected)
            // Clean selected words (remove punctuation) for the dictionary lookup
            .map(w => w.text.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ""))
            .filter(w => w.length > 0); // Remove empty strings after cleaning

        // Remove duplicates if desired, or keep them. Let's keep unique words.
        const uniqueWords = Array.from(new Set(selectedWords));

        onConfirm(uniqueWords);
        onClose();
    };

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                <TouchableOpacity
                    style={StyleSheet.absoluteFill}
                    activeOpacity={1}
                    onPress={onClose}
                />
                <View style={styles.content}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Sélectionner les mots à définir</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <X size={24} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.scrollArea} contentContainerStyle={styles.wordsContainer}>
                        {words.map((item) => (
                            <TouchableOpacity
                                key={item.id}
                                onPress={() => toggleWord(item.id)}
                                style={[
                                    styles.wordChip,
                                    item.selected && styles.wordChipSelected
                                ]}
                            >
                                <Text style={[
                                    styles.wordText,
                                    item.selected && styles.wordTextSelected
                                ]}>
                                    {item.text}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={[styles.confirmButton, words.filter(w => w.selected).length === 0 && styles.confirmButtonDisabled]}
                            onPress={handleConfirm}
                            disabled={words.filter(w => w.selected).length === 0}
                        >
                            <Check size={20} color={words.filter(w => w.selected).length === 0 ? colors.textTertiary : colors.buttonText} />
                            <Text style={[styles.confirmText, words.filter(w => w.selected).length === 0 && styles.confirmTextDisabled]}>
                                Confirmer la sélection
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: colors.backdrop,
    },
    content: {
        backgroundColor: colors.background,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '80%',
        paddingBottom: 40,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
    },
    closeButton: {
        padding: 4,
    },
    scrollArea: {
        padding: 20,
    },
    wordsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    wordChip: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.surfaceHighlight,
    },
    wordChipSelected: {
        backgroundColor: colors.primaryLight,
        borderColor: colors.primary,
    },
    wordText: {
        fontSize: 16,
        color: colors.textSecondary,
    },
    wordTextSelected: {
        color: colors.primary,
        fontWeight: '600',
    },
    footer: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    confirmButton: {
        backgroundColor: colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        gap: 8,
    },
    confirmButtonDisabled: {
        backgroundColor: colors.surfaceHighlight,
        borderWidth: 1,
        borderColor: colors.border,
    },
    confirmText: {
        color: colors.buttonText,
        fontSize: 16,
        fontWeight: '600',
    },
    confirmTextDisabled: {
        color: colors.textTertiary,
    },
});
