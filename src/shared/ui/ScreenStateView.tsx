import React from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { tokens as defaultTokens } from '@/src/shared/theme';

interface ScreenStateViewProps {
  isLoading?: boolean;
  error?: Error | string | null;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptySubtitle?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  onRetry?: () => void;
  children: React.ReactNode;
}

export const ScreenStateView: React.FC<ScreenStateViewProps> = ({
  isLoading,
  error,
  isEmpty,
  emptyTitle = 'Aucun élément',
  emptySubtitle = 'Il n’y a aucune donnée à afficher pour le moment.',
  emptyActionLabel,
  onEmptyAction,
  onRetry,
  children,
}) => {
  const { colors, tokens = defaultTokens } = useTheme();
  const styles = React.useMemo(() => createStyles(tokens), [tokens]);

  // 1. État Chargement
  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // 2. État Erreur / Offline
  if (error) {
    const message = typeof error === 'string' ? error : error.message || 'Une erreur réseau est survenue.';
    return (
      <View style={styles.centerContainer}>
        <Text style={[styles.title, { color: colors.text }]}>Oups !</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{message}</Text>
        {onRetry && (
          <TouchableOpacity style={[styles.button, { backgroundColor: colors.primary }]} onPress={onRetry}>
            <Text style={styles.buttonText}>Réessayer</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // 3. État Vide (Empty State)
  if (isEmpty) {
    return (
      <View style={styles.centerContainer}>
        <Text style={[styles.title, { color: colors.text }]}>{emptyTitle}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{emptySubtitle}</Text>
        {emptyActionLabel && onEmptyAction && (
          <TouchableOpacity style={[styles.button, { backgroundColor: colors.primary }]} onPress={onEmptyAction}>
            <Text style={styles.buttonText}>{emptyActionLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // 4. État Succès / Contenu
  return <>{children}</>;
};

const createStyles = (tokens: any) => StyleSheet.create({
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.lg,
  },
  title: {
    fontSize: tokens.typography.fontSize.heading,
    lineHeight: tokens.typography.lineHeight.heading,
    fontFamily: tokens.typography.fontFamily.display,
    fontWeight: tokens.typography.fontWeight.bold,
    marginBottom: tokens.spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: tokens.typography.fontSize.sm,
    fontFamily: tokens.typography.fontFamily.body,
    textAlign: 'center',
    marginBottom: tokens.spacing.md,
  },
  button: {
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radii.sm,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: tokens.typography.fontWeight.semibold,
    fontSize: tokens.typography.fontSize.sm,
  },
});
