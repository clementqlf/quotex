import { useTheme } from '@/src/app/providers/ThemeContext';
import { useSmartNavigation } from '@/src/shared/lib/hooks/useSmartNavigation';
import { ThemeColors } from '@/src/shared/theme';
import { TypingText } from '@/src/shared/ui/TypingText';
import { ChevronDown } from 'lucide-react-native';
import React, { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Avatar } from '@/src/shared/ui/Avatar';

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
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
    marginRight: 16,
  },
});

export { AuthorCardData };
export default AuthorCardItem;
