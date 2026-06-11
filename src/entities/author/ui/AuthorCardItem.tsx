import { useTheme } from '@/src/app/providers/ThemeContext';
import { useSmartNavigation } from '@/src/shared/lib/hooks/useSmartNavigation';
import { ThemeColors } from '@/src/shared/theme';
import { TypingText } from '@/src/shared/ui/TypingText';
import { Image } from 'expo-image';
import { ChevronDown } from 'lucide-react-native';
import React, { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

interface AuthorCardData {
  name: string;
  image?: string | null;
  quoteCount: number;
  inventaireUri?: string;
}

interface AuthorCardItemProps {
  author: AuthorCardData;
}

const AuthorCardItem = React.memo(({ author }: AuthorCardItemProps) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { navigateToAuthor } = useSmartNavigation();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.bookCard,
        { opacity: pressed ? 0.85 : 1 }
      ]}
      onPress={() => navigateToAuthor(author.name, author.inventaireUri)}
    >
      <View style={[styles.bookCardContent, { alignItems: 'center' }]}>
        {author.image ? (
          <Image source={{ uri: author.image }} style={styles.authorAvatar} />
        ) : (
          <View style={styles.authorAvatarPlaceholder}>
            <Text style={styles.authorAvatarText}>{author.name.charAt(0)}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <TypingText style={styles.bookCardTitle} text={author.name} />
          <Text style={styles.bookCardCount}>{author.quoteCount} citation{author.quoteCount > 1 ? 's' : ''}</Text>
        </View>
        <ChevronDown size={20} color={colors.textSecondary} style={{ transform: [{ rotate: '-90deg' }] }} />
      </View>
    </Pressable>
  );
});

AuthorCardItem.displayName = 'AuthorCardItem';

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  bookCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.surfaceHighlight,
    overflow: 'hidden',
  },
  bookCardContent: {
    flexDirection: 'row',
    padding: 12,
  },
  bookCardTitle: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
    marginBottom: 4,
  },
  bookCardCount: {
    fontSize: 12,
    color: colors.textTertiary,
    fontStyle: 'italic',
  },
  authorAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
    backgroundColor: colors.surfaceHighlight,
  },
  authorAvatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  authorAvatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
  },
});

export { AuthorCardData };
export default AuthorCardItem;
