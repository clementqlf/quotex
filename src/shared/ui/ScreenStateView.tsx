import React from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/src/app/providers/ThemeContext';

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
  const { colors } = useTheme();

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

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});
