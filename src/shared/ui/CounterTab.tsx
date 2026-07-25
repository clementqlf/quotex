import React from 'react';
import {
  TouchableOpacity,
  TouchableOpacityProps,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { tokens as defaultTokens } from '@/src/shared/theme';
import { AppText as Text } from './AppText';

export interface CounterTabProps extends TouchableOpacityProps {
  /** Valeur numérique à afficher */
  value: number | string;
  /** Label à afficher sous la valeur */
  label: string;
  /** Si true, l'onglet est actif (style différent) */
  isActive?: boolean;
  /** Style personnalisé pour le conteneur */
  containerStyle?: ViewStyle | ViewStyle[];
}

/**
 * Onglet-compteur atomique avec style cohérent (utilisé dans MyQuotesScreen, UserProfile, etc.)
 * Affiche une valeur numérique avec un label en dessous, dans une carte cliquable.
 */
export const CounterTab: React.FC<CounterTabProps> = React.memo(({
  value,
  label,
  isActive = false,
  containerStyle,
  onPress,
  accessible = true,
  accessibilityRole = 'tab',
  accessibilityLabel,
  accessibilityState,
  ...rest
}) => {
  const { colors, tokens = defaultTokens } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      accessible={accessible}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel || `${label}, ${value}`}
      accessibilityState={accessibilityState}
      activeOpacity={0.8}
      style={[
        styles.statItem,
        {
          backgroundColor: isActive ? colors.primaryLight : colors.surface,
          borderColor: isActive ? colors.primary : colors.border,
          borderRadius: tokens.radii.lg || 12,
        },
        containerStyle,
      ]}
      {...rest}
    >
      <Text style={[styles.statValue, { color: colors.primary }]}>
        {value ?? 0}
      </Text>
      {label && (
        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
});

CounterTab.displayName = 'CounterTab';

const styles = StyleSheet.create({
  statItem: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
});
