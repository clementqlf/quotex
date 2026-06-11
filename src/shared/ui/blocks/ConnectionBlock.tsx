import { useTheme } from '@/src/app/providers/ThemeContext';
import { BlockKey } from '@/src/shared/config/blocks';
import { ThemeColors } from '@/src/shared/theme';
import { BookOpen, Link, User } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BlockWrapper } from './BlockWrapper';

interface ConnectionData {
    type: 'book' | 'author';
    id: string | number;
    title?: string;
    name?: string;
    image?: string;
    inventaireUri?: string;
}

interface ConnectionBlockProps {
    blockId: string;
    blockKey?: BlockKey;
    data?: ConnectionData | null;
    onUpdate: (data: ConnectionData | null) => void;
    onRemove?: () => void;
    onSearchPress?: () => void; // Parent handles opening search
    onNavigate?: (type: 'book' | 'author', id: string | number, uri?: string) => void;
}

const ConnectionBlockUI: React.FC<ConnectionBlockProps> = ({
    blockId,
    blockKey = 'connection',
    data,
    onUpdate,
    onRemove,
    onSearchPress,
    onNavigate
}) => {
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const handleUnlink = () => {
        onUpdate(null);
    };

    if (!data) {
        return (
            <BlockWrapper blockKey={blockKey} onRemove={onRemove}>
                <TouchableOpacity style={styles.emptyButton} onPress={onSearchPress}>
                    <Link size={20} color={colors.primary} />
                    <Text style={styles.emptyButtonText}>Lier à une ressource</Text>
                    <Text style={styles.emptyButtonSubtext}>Connectez cette citation à un autre livre ou auteur.</Text>
                </TouchableOpacity>
            </BlockWrapper>
        );
    }

    const isBook = data.type === 'book';
    const displayName = isBook ? data.title : data.name;
    const Icon = isBook ? BookOpen : User;

    return (
        <BlockWrapper blockKey={blockKey} onRemove={onRemove}>
            <View style={styles.connectedContainer}>
                <TouchableOpacity 
                    style={styles.resourceCard}
                    onPress={() => onNavigate?.(data.type, isBook ? data.id : (data.name || data.id), data.inventaireUri)}
                >
                    <View style={styles.imageContainer}>
                        {data.image ? (
                            <Image source={{ uri: data.image }} style={styles.image} />
                        ) : (
                            <View style={styles.placeholderImage}>
                                <Icon size={24} color={colors.textTertiary} />
                            </View>
                        )}
                    </View>
                    <View style={styles.infoContainer}>
                        <Text style={styles.resourceType}>{isBook ? 'Livre' : 'Auteur'}</Text>
                        <Text style={styles.resourceName} numberOfLines={2}>{displayName}</Text>
                    </View>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.unlinkButton} onPress={handleUnlink}>
                    <Text style={styles.unlinkText}>Détacher</Text>
                </TouchableOpacity>
            </View>
        </BlockWrapper>
    );
};

export const ConnectionBlock = React.memo(ConnectionBlockUI, (prevProps, nextProps) => {
    return (
        prevProps.data?.id === nextProps.data?.id &&
        prevProps.data?.type === nextProps.data?.type &&
        prevProps.blockId === nextProps.blockId
    );
});

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    emptyButton: {
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surfaceHighlight,
        borderRadius: 12,
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: colors.primary,
    },
    emptyButtonText: {
        color: colors.primary,
        fontWeight: '600',
        marginTop: 8,
        fontSize: 15,
    },
    emptyButtonSubtext: {
        color: colors.textSecondary,
        fontSize: 12,
        textAlign: 'center',
        marginTop: 4,
    },
    connectedContainer: {
        gap: 12,
    },
    resourceCard: {
        flexDirection: 'row',
        backgroundColor: colors.background,
        borderRadius: 12,
        padding: 10,
        borderWidth: 1,
        borderColor: colors.surfaceHighlight,
        alignItems: 'center',
    },
    imageContainer: {
        width: 50,
        height: 50,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: colors.surfaceHighlight,
    },
    image: {
        width: '100%',
        height: '100%',
    },
    placeholderImage: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    infoContainer: {
        flex: 1,
        marginLeft: 12,
    },
    resourceType: {
        fontSize: 10,
        color: colors.textTertiary,
        textTransform: 'uppercase',
        fontWeight: '700',
        marginBottom: 2,
    },
    resourceName: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
    },
    unlinkButton: {
        alignSelf: 'flex-end',
        paddingVertical: 6,
        paddingHorizontal: 12,
        backgroundColor: colors.surfaceHighlight,
        borderRadius: 6,
    },
    unlinkText: {
        fontSize: 12,
        color: colors.textSecondary,
        fontWeight: '500',
    }
});
