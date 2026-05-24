import React, { useMemo } from 'react';
import { TextInput, StyleSheet } from 'react-native';
import { BlockWrapper } from './BlockWrapper';
import { BlockKey } from '@/src/shared/config/blocks';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { ThemeColors } from '@/src/shared/theme';

interface NotesBlockProps {
    blockKey?: BlockKey;
    content: string;
    onUpdate: (text: string) => void;
    placeholder?: string;
    isEditable?: boolean; // Could be used to disable editing
    onRemove?: () => void;
}

export const NotesBlock: React.FC<NotesBlockProps> = ({
    blockKey = 'notes',
    content,
    onUpdate,
    placeholder = "Écrire des notes...",
    isEditable = true,
    onRemove
}) => {
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    return (
        <BlockWrapper blockKey={blockKey} onRemove={onRemove}>
            <TextInput
                style={styles.notesInput}
                placeholder={placeholder}
                placeholderTextColor={colors.inputPlaceholder}
                multiline
                numberOfLines={6}
                value={content}
                onChangeText={onUpdate}
                textAlignVertical="top"
                editable={isEditable}
            />
        </BlockWrapper>
    );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    notesInput: {
        backgroundColor: colors.inputBackground,
        borderRadius: 8,
        padding: 12,
        color: colors.inputText,
        fontSize: 14,
        minHeight: 100,
    },
});
