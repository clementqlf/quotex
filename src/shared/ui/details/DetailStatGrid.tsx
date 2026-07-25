import React from 'react';
import { View, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { tokens as defaultTokens } from '@/src/shared/theme';

export interface StatItem {
  key: string;
  icon?: React.ReactNode;
  label: string;
  value?: string | number | null;
  onPress?: () => void;
}

export interface DetailStatGridProps {
  /** Liste des statistiques à afficher en grille ou en ligne */
  stats: StatItem[];
  /** Si true, affiche les stats sous forme de grille (box cards) plutôt que liste inline */
  variant?: 'grid' | 'inline';
  style?: ViewStyle;
}

/**
 * Grille de métriques/statistiques réutilisable pour les fiches détail.
 * Mode 'inline' : icône + libellé + valeur sur une ligne (style métadonnées).
 * Mode 'grid' : boîtes carrées empilées en colonnes (style stats sociales).
 */
export const DetailStatGrid: React.FC<DetailStatGridProps> = React.memo(({
  stats,
  variant = 'inline',
  style,
}) => {
  const { colors, tokens = defaultTokens } = useTheme();

  if (variant === 'grid') {
    return (
      <View
        style={[
          {
            flexDirection: 'row',
            gap: tokens.spacing.sm,
          },
          style,
        ]}
      >
        {stats.map((stat) => {
          const Wrapper: any = stat.onPress ? TouchableOpacity : View;
          return (
            <Wrapper
              key={stat.key}
              onPress={stat.onPress}
              activeOpacity={stat.onPress ? 0.7 : 1}
              style={{
                flex: 1,
                backgroundColor: colors.surfaceHighlight,
                borderRadius: tokens.radii.md,
                padding: tokens.spacing.md,
                alignItems: 'center',
                justifyContent: 'center',
                gap: tokens.spacing.xs,
              }}
            >
              {stat.value !== undefined && stat.value !== null && (
                <Text
                  style={{
                    fontSize: tokens.typography.fontSize.xl,
                    fontWeight: tokens.typography.fontWeight.bold,
                    color: colors.text,
                    fontFamily: tokens.typography.fontFamily.body,
                  }}
                >
                  {stat.value}
                </Text>
              )}
              <Text
                style={{
                  fontSize: tokens.typography.fontSize.xs,
                  color: colors.textSecondary,
                  fontFamily: tokens.typography.fontFamily.body,
                }}
              >
                {stat.label}
              </Text>
            </Wrapper>
          );
        })}
      </View>
    );
  }

  // Mode 'inline' : ligne icône + label + valeur
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: tokens.spacing.sm,
        },
        style,
      ]}
    >
      {stats.map((stat) => (
        <View
          key={stat.key}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: tokens.spacing.xs,
          }}
        >
          {stat.icon}
          <Text
            style={{
              fontSize: tokens.typography.fontSize.xs + 1,
              color: colors.textTertiary,
              fontFamily: tokens.typography.fontFamily.body,
            }}
          >
            {stat.value}
          </Text>
        </View>
      ))}
    </View>
  );
});

DetailStatGrid.displayName = 'DetailStatGrid';
