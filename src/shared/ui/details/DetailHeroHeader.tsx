import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { tokens as defaultTokens } from '@/src/shared/theme';
import { Badge } from '../Badge';

export interface DetailHeroHeaderBadge {
  key: string;
  label: string;
  color?: string;        // Couleur principale du badge (optionnelle, sinon utilise primary)
  onPress?: () => void;
  onLongPress?: () => void;
}

export interface DetailHeroHeaderProps {
  /** Image de couverture ou avatar (noeud React : <BookCover/> ou <Avatar/>) */
  visual: React.ReactNode;
  /** Titre principal (Titre du livre ou Nom de l'auteur) */
  title: string;
  /** Sous-titre cliquable (Auteur du livre, nationalité...) */
  subtitle?: string;
  onSubtitlePress?: () => void;
  /** Liste de badges de statut et de genre */
  badges?: DetailHeroHeaderBadge[];
  /** Statistiques (Année, Pages, Note...) en ligne sous le titre */
  stats?: React.ReactNode;
  /** Contenu personnalisé additionnel sous les stats */
  children?: React.ReactNode;
  style?: ViewStyle;
}

/**
 * En-tête hero réutilisable pour les fiches de détail (Livre, Auteur).
 * Combine l'image principale, le titre, le sous-titre cliquable, les badges et les stats.
 */
export const DetailHeroHeader: React.FC<DetailHeroHeaderProps> = React.memo(({
  visual,
  title,
  subtitle,
  onSubtitlePress,
  badges = [],
  stats,
  children,
  style,
}) => {
  const { colors, tokens = defaultTokens } = useTheme();

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          gap: tokens.spacing.md,
          padding: tokens.spacing.md,
        },
        style,
      ]}
    >
      {/* Colonne de gauche : image */}
      {visual}

      {/* Colonne de droite : infos */}
      <View style={{ flex: 1, justifyContent: 'center', gap: tokens.spacing.xs }}>
        {/* Titre */}
        <Text
          style={{
            fontSize: tokens.typography.fontSize.lg + 4,
            lineHeight: tokens.typography.lineHeight.lg + 4,
            fontWeight: tokens.typography.fontWeight.semibold,
            color: colors.text,
            fontFamily: tokens.typography.fontFamily.display,
          }}
        >
          {title}
        </Text>

        {/* Sous-titre cliquable */}
        {subtitle && (
          <TouchableOpacity
            onPress={onSubtitlePress}
            disabled={!onSubtitlePress}
            activeOpacity={onSubtitlePress ? 0.7 : 1}
          >
            <Text
              style={{
                fontSize: tokens.typography.fontSize.sm,
                color: colors.primary,
                fontFamily: tokens.typography.fontFamily.body,
              }}
            >
              {subtitle}
            </Text>
          </TouchableOpacity>
        )}

        {/* Stats inline (Année, Pages, Note...) */}
        {stats}

        {/* Badges de statut/genre */}
        {badges.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.xs, marginTop: tokens.spacing.xs }}>
            {badges.map((badge) => (
              <Badge
                key={badge.key}
                label={badge.label}
                size="sm"
                variant="outline"
                onPress={badge.onPress}
                style={badge.color ? {
                  backgroundColor: badge.color + '15',
                  borderColor: badge.color + '40',
                } : undefined}
                textStyle={badge.color ? { color: badge.color } : undefined}
              />
            ))}
          </View>
        )}

        {/* Contenu additionnel (ex : bouton Suivre) */}
        {children}
      </View>
    </View>
  );
});

DetailHeroHeader.displayName = 'DetailHeroHeader';
