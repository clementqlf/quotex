import { useTheme } from '@/src/app/providers/ThemeContext';
import { BlockKey } from '@/src/shared/config/blocks';
import { ThemeColors } from '@/src/shared/theme';
import {
    Bold,
    Heading1,
    Heading2,
    Italic,
    List,
    ListOrdered,
    Underline,
} from 'lucide-react-native';
import React, { useCallback, useRef, useState, useMemo, useEffect } from 'react';
import {
    Keyboard,
    Platform,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
    NativeSyntheticEvent,
} from 'react-native';
import {
    EnrichedTextInput,
    EnrichedTextInputInstance,
    OnChangeHtmlEvent,
} from 'react-native-enriched-html';
import { BlockWrapper } from './BlockWrapper';

// ─── Props ────────────────────────────────────────────────────────────────────

interface NotesBlockProps {
    blockKey?: BlockKey;
    content: string;
    onUpdate: (text: string) => void;
    placeholder?: string;
    isEditable?: boolean;
    onRemove?: () => void;
    notesEditorRef?: React.MutableRefObject<any>;
    onNotesFocusChange?: (isFocused: boolean) => void;
}

// ─── Formatting Toolbar ───────────────────────────────────────────────────────

interface ToolbarProps {
    onBold: () => void;
    onItalic: () => void;
    onUnderline: () => void;
    onH1: () => void;
    onH2: () => void;
    onBulletList: () => void;
    onOrderedList: () => void;
    styles: any;
    colors: ThemeColors;
}

export function FormattingToolbar({
    onBold,
    onItalic,
    onUnderline,
    onH1,
    onH2,
    onBulletList,
    onOrderedList,
    styles,
    colors,
}: ToolbarProps) {
    return (
        <View style={styles.toolbar}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.toolbarContent}
                keyboardShouldPersistTaps="always"
            >
                <TouchableOpacity style={styles.toolbarBtn} onPressIn={onBold}>
                    <Bold size={16} color={colors.text} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.toolbarBtn} onPressIn={onItalic}>
                    <Italic size={16} color={colors.text} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.toolbarBtn} onPressIn={onUnderline}>
                    <Underline size={16} color={colors.text} />
                </TouchableOpacity>

                <View style={styles.toolbarDivider} />

                <TouchableOpacity style={styles.toolbarBtn} onPressIn={onH1}>
                    <Heading1 size={16} color={colors.text} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.toolbarBtn} onPressIn={onH2}>
                    <Heading2 size={16} color={colors.text} />
                </TouchableOpacity>

                <View style={styles.toolbarDivider} />

                <TouchableOpacity style={styles.toolbarBtn} onPressIn={onBulletList}>
                    <List size={16} color={colors.text} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.toolbarBtn} onPressIn={onOrderedList}>
                    <ListOrdered size={16} color={colors.text} />
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const NotesBlockUI: React.FC<NotesBlockProps> = ({
    blockKey = 'notes',
    content,
    onUpdate,
    placeholder = 'Écrire des notes...',
    isEditable = true,
    onRemove,
    notesEditorRef,
    onNotesFocusChange,
}) => {
    const { colors } = useTheme();
    const styles = createStyles(colors);

    const [, setIsFocused] = useState(false);
    const inputRef = useRef<EnrichedTextInputInstance>(null);
    const lastSavedContentRef = useRef(content);
    
    useEffect(() => {
        lastSavedContentRef.current = content;
    }, [content]);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Sync content changes from parent (e.g. if selecting a different quote)
    useEffect(() => {
        if (content !== lastSavedContentRef.current) {
            inputRef.current?.setValue(content);
        }
    }, [content]);

    // Sync local ref with parent ref
    useEffect(() => {
        if (notesEditorRef) {
            notesEditorRef.current = inputRef.current;
        }
        return () => {
            if (notesEditorRef) {
                notesEditorRef.current = null;
            }
        };
    }, [notesEditorRef]);

    // Clean up timer on unmount
    useEffect(() => {
        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, []);

    const handleFocus = useCallback(() => {
        setIsFocused(true);
        onNotesFocusChange?.(true);
    }, [onNotesFocusChange]);

    const handleBlur = useCallback(() => {
        setIsFocused(false);
        onNotesFocusChange?.(false);
        // Flush any pending changes immediately on blur
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
            debounceRef.current = null;
            onUpdate(lastSavedContentRef.current);
        }
    }, [onUpdate, onNotesFocusChange]);

    const handleHtmlChange = useCallback((e: NativeSyntheticEvent<OnChangeHtmlEvent>) => {
        const html = e.nativeEvent.value;
        lastSavedContentRef.current = html;

        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        debounceRef.current = setTimeout(() => {
            onUpdate(html);
        }, 300);
    }, [onUpdate]);

    // Custom styling for rich HTML elements inside the editor
    const htmlStyle = useMemo(() => ({
        h1: {
            fontSize: 20,
            bold: true,
            color: colors.primary,
        },
        h2: {
            fontSize: 17,
            bold: true,
            color: colors.text,
        },
        blockquote: {
            borderColor: colors.border,
            borderWidth: 2,
            color: colors.textSecondary,
        },
        ul: {
            bulletColor: colors.primary,
        },
        ol: {
            markerColor: colors.primary,
        }
    }), [colors]);

    return (
        <BlockWrapper blockKey={blockKey} onRemove={onRemove}>
            <EnrichedTextInput
                ref={inputRef}
                style={styles.textInput}
                defaultValue={content}
                placeholder={placeholder}
                placeholderTextColor={colors.inputPlaceholder}
                onChangeHtml={handleHtmlChange}
                onFocus={handleFocus}
                onBlur={handleBlur}
                editable={isEditable}
                scrollEnabled={false}
                htmlStyle={htmlStyle}
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

// ─── Keyboard Toolbar Hook & Component ────────────────────────────────────────

export function useKeyboardToolbar() {
    const [isNotesFocused, setIsNotesFocused] = useState(false);
    const notesEditorRef = useRef<any>(null);
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const showListener = Keyboard.addListener(showEvent, (e) => {
            setKeyboardHeight(e.endCoordinates.height);
        });
        const hideListener = Keyboard.addListener(hideEvent, () => {
            setKeyboardHeight(0);
        });

        return () => {
            showListener.remove();
            hideListener.remove();
        };
    }, []);

    return {
        isNotesFocused,
        setIsNotesFocused,
        notesEditorRef,
        keyboardHeight,
    };
}

interface NotesKeyboardToolbarProps {
    isNotesFocused: boolean;
    keyboardHeight: number;
    notesEditorRef: React.RefObject<any>;
}

export function NotesKeyboardToolbar({
    isNotesFocused,
    keyboardHeight,
    notesEditorRef,
}: NotesKeyboardToolbarProps) {
    const { colors } = useTheme();
    const styles = createStyles(colors);

    if (!isNotesFocused) return null;

    return (
        <View
            style={[
                styles.keyboardToolbarContainer,
                { bottom: keyboardHeight }
            ]}
        >
            <FormattingToolbar
                onBold={() => notesEditorRef.current?.toggleBold()}
                onItalic={() => notesEditorRef.current?.toggleItalic()}
                onUnderline={() => notesEditorRef.current?.toggleUnderline()}
                onH1={() => notesEditorRef.current?.toggleH1()}
                onH2={() => notesEditorRef.current?.toggleH2()}
                onBulletList={() => notesEditorRef.current?.toggleUnorderedList()}
                onOrderedList={() => notesEditorRef.current?.toggleOrderedList()}
                styles={styles}
                colors={colors}
            />
        </View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (colors: ThemeColors) =>
    StyleSheet.create({
        textInput: {
            color: colors.inputText,
            fontSize: 15,
            lineHeight: 22,
            minHeight: 80,
            paddingTop: 8,
            paddingBottom: 8,
        },

        // ── Toolbar ──
        toolbar: {
            backgroundColor: colors.surface,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            paddingVertical: 2,
            marginBottom: 6,
        },
        toolbarContent: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 4,
            gap: 2,
        },
        toolbarBtn: {
            width: 32,
            height: 32,
            borderRadius: 6,
            alignItems: 'center',
            justifyContent: 'center',
        },
        toolbarDivider: {
            width: 1,
            height: 16,
            backgroundColor: colors.border,
            marginHorizontal: 4,
        },
        keyboardToolbarContainer: {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            zIndex: 9999,
        },
    });
