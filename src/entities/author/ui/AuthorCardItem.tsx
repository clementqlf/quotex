import { useTheme } from '@/src/app/providers/ThemeContext';
import { useSmartNavigation } from '@/src/shared/lib/hooks/useSmartNavigation';
import { ThemeColors, tokens as defaultTokens } from '@/src/shared/theme';
import { AppText, TypingText } from '@/src/shared/ui';
import { Avatar } from '@/src/shared/ui/Avatar';
import { ChevronDown } from 'lucide-react-native';
import React, { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { useSinglePress } from '@/src/shared/lib/pressUtils';

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
  const { colors, tokens = defaultTokens } = useTheme();
  const styles = useMemo(() => createStyles(colors, tokens), [colors, tokens]);
  const { navigateToAuthor } = useSmartNavigation();

  const handlePress = useSinglePress(() => {
    navigateToAuthor(author.name, author.inventaireUri);
  }, 500, [navigateToAuthor, author.name, author.inventaireUri]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.bookCard,
        { opacity: pressed ? 0.85 : 1 }
      ]}
      onPress={handlePress}
    >
      <View style={[styles.bookCardContent, { alignItems: 'center' }]}>
        <Avatar uri={author.image} name={author.name} size={60} style={styles.authorAvatar} />
        <View style={{ flex: 1 }}>
          <TypingText style={styles.bookCardTitle} text={author?.name || 'Auteur inconnu'} />
          <AppText style={styles.bookCardCount}>{author.quoteCount} citation{author.quoteCount > 1 ? 's' : ''}</AppText>
        </View>
        <ChevronDown size={20} color={colors.textSecondary} style={{ transform: [{ rotate: '-90deg' }] }} />
      </View>
    </Pressable>
  );
});

AuthorCardItem.displayName = 'AuthorCardItem';

const createStyles = (colors: ThemeColors, tokens: any) => StyleSheet.create({
  bookCard: {
    backgroundColor: colors.surface,
    borderRadius: tokens.radii.md,
    marginBottom: tokens.spacing.sm + 4,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  bookCardContent: {
    flexDirection: 'row',
    padding: tokens.spacing.sm + 4,
  },
  bookCardTitle: {
    fontSize: tokens.typography.fontSize.md,
    color: colors.text,
    fontWeight: tokens.typography.fontWeight.semibold,
    marginBottom: tokens.spacing.xs,
  },
  bookCardCount: {
    fontSize: tokens.typography.fontSize.xs,
    color: colors.textTertiary,
    fontStyle: 'italic',
  },
  authorAvatar: {
    marginRight: tokens.spacing.md,
  },
});

export { AuthorCardData };
export default AuthorCardItem;
