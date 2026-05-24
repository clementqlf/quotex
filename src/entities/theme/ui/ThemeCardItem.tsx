import React, { useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { ThemeColors } from '@/src/shared/theme';

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
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { opacity: pressed ? 0.85 : 1 }
      ]}
      onPress={() => router.navigate({ pathname: '/theme-detail', params: { themeName: theme.theme } })}
    >
      <View style={[styles.cardContent, { alignItems: 'center' }]}>
        <View style={styles.themeIconContainer}>
          <Text style={styles.themeIconText}>{theme.theme[0]}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.themeTitle}>{theme.theme}</Text>
          <Text style={styles.themeSubText}>{theme.books.length} livre{theme.books.length > 1 ? 's' : ''} • {theme.quoteCount} citation{theme.quoteCount > 1 ? 's' : ''}</Text>
        </View>
      </View>
    </Pressable>
  );
});

ThemeCardItem.displayName = 'ThemeCardItem';

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.surfaceHighlight,
    overflow: 'hidden',
  },
  cardContent: {
    flexDirection: 'row',
    padding: 12,
  },
  themeIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  themeIconText: {
    color: colors.primary,
    fontWeight: 'bold',
    fontSize: 24,
  },
  themeTitle: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 16,
  },
  themeSubText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
});

export { ThemeCardData };
export default ThemeCardItem;
