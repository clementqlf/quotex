import { useTheme } from '@/src/app/providers/ThemeContext';
import { AppText } from '@/src/shared/ui';
import { ThemeColors, tokens as defaultTokens } from '@/src/shared/theme';
import { useRouter } from '@/src/shared/navigation/useRouter';
import React, { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { useSinglePress } from '@/src/shared/lib/pressUtils';

interface ThemeCardData {
  theme: string;
  books: string[];
  quoteCount: number;
}

interface ThemeCardItemProps {
  theme: ThemeCardData;
}

const ThemeCardItem = React.memo(({ theme }: ThemeCardItemProps) => {
  const router = useRouter();
  const { colors, tokens = defaultTokens } = useTheme();
  const styles = useMemo(() => createStyles(colors, tokens), [colors, tokens]);

  const handlePress = useSinglePress(() => {
    router.navigate({ pathname: '/theme-detail', params: { themeName: theme.theme } });
  }, 500, [router, theme.theme]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { opacity: pressed ? 0.85 : 1 }
      ]}
      onPress={handlePress}
    >
      <View style={[styles.cardContent, { alignItems: 'center' }]}>
        <View style={styles.themeIconContainer}>
          <AppText style={styles.themeIconText}>{theme.theme[0]}</AppText>
        </View>
        <View style={{ flex: 1 }}>
          <AppText style={styles.themeTitle}>{theme.theme}</AppText>
          <AppText style={styles.themeSubText}>{theme.books.length} livre{theme.books.length > 1 ? 's' : ''} • {theme.quoteCount} citation{theme.quoteCount > 1 ? 's' : ''}</AppText>
        </View>
      </View>
    </Pressable>
  );
});

ThemeCardItem.displayName = 'ThemeCardItem';

const createStyles = (colors: ThemeColors, tokens: any) => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: tokens.radii.md,
    marginBottom: tokens.spacing.sm + 4,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardContent: {
    flexDirection: 'row',
    padding: tokens.spacing.sm + 4,
  },
  themeIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: tokens.spacing.md,
  },
  themeIconText: {
    color: colors.primary,
    fontWeight: tokens.typography.fontWeight.bold,
    fontSize: tokens.typography.fontSize.xxl,
  },
  themeTitle: {
    color: colors.text,
    fontWeight: tokens.typography.fontWeight.semibold,
    fontSize: tokens.typography.fontSize.md,
  },
  themeSubText: {
    color: colors.textSecondary,
    fontSize: tokens.typography.fontSize.xs + 1,
  },
});

export { ThemeCardData };
export default ThemeCardItem;
