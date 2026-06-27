import { useTheme } from '@/src/app/providers/ThemeContext';
import { BlockKey } from '@/src/shared/config/blocks';
import { ThemeColors } from '@/src/shared/theme';
import React from 'react';
import { StyleSheet, TextInput } from 'react-native';
import { BlockWrapper } from './BlockWrapper';

interface NotesBlockProps {
    blockKey?: BlockKey;
    content: string;
    onUpdate: (text: string) => void;
    placeholder?: string;
    isEditable?: boolean; // Could be used to disable editing
    onRemove?: () => void;
}

const NotesBlockUI: React.FC<NotesBlockProps> = ({
    blockKey = 'notes',
    content,
    onUpdate,
    placeholder = "Écrire des notes...",
    isEditable = true,
    onRemove
}) => {
    const { colors } = useTheme();
    const styles = createStyles(colors);

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

export const NotesBlock = React.memo(NotesBlockUI, (prevProps, nextProps) => {
    return (
        prevProps.blockKey === nextProps.blockKey &&
        prevProps.content === nextProps.content &&
        prevProps.isEditable === nextProps.isEditable
    );
});

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
