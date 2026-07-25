import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
} from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { ChevronLeft } from 'lucide-react-native';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { tokens as defaultTokens } from '@/src/shared/theme';
import { IconButton } from '../IconButton';

export interface DetailHeaderAction {
  key: string;
  icon: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}

export interface DetailHeaderBarProps {
  title: string;
  onBack: () => void;
  actions?: DetailHeaderAction[];
  style?: ViewStyle;
  titleStyle?: TextStyle;
}

/**
 * Barre d'en-tête supérieure réutilisable pour les fiches détail (Livre, Auteur, Citation).
 * Inclut le bouton retour, le titre tronqué avec dégradé de masque et les boutons d'action.
 */
export const DetailHeaderBar: React.FC<DetailHeaderBarProps> = React.memo(({
  title,
  onBack,
  actions = [],
  style,
  titleStyle,
}) => {
  const { colors, tokens = defaultTokens } = useTheme();

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: tokens.spacing.md,
          paddingVertical: tokens.spacing.sm + 2,
          backgroundColor: colors.background,
        },
        style,
      ]}
    >
      {/* Bouton Retour */}
      <IconButton
        icon={<ChevronLeft size={24} color={colors.text} />}
        variant="ghost"
        size="md"
        onPress={onBack}
        accessibilityLabel="Retour"
        enableHaptics={false}
        style={{ marginLeft: -tokens.spacing.xs }}
      />

      {/* Titre avec masque de dégradé */}
      <View style={{ flex: 1, overflow: 'hidden', position: 'relative', marginHorizontal: tokens.spacing.xs }}>
        <Text
          numberOfLines={1}
          ellipsizeMode="clip"
          style={[
            {
              fontSize: tokens.typography.fontSize.md,
              fontWeight: tokens.typography.fontWeight.semibold,
              color: colors.text,
              fontFamily: tokens.typography.fontFamily.body,
            },
            titleStyle,
          ]}
        >
          {title}
        </Text>
        {/* Dégradé de masque à droite pour le titre */}
        <View
          style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 32 }}
          pointerEvents="none"
        >
          <Svg width={32} height="100%">
            <Defs>
              <LinearGradient id={`headerFade-${title.slice(0, 5)}`} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={colors.background} stopOpacity={0} />
                <Stop offset="1" stopColor={colors.background} stopOpacity={1} />
              </LinearGradient>
            </Defs>
            <Rect width={32} height="100%" fill={`url(#headerFade-${title.slice(0, 5)})`} />
          </Svg>
        </View>
      </View>

      {/* Boutons d'action à droite */}
      {actions.length > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.xs }}>
          {actions.map((action) => (
            <TouchableOpacity
              key={action.key}
              onPress={action.onPress}
              disabled={action.disabled}
              style={[
                {
                  width: 40,
                  height: 40,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: action.disabled ? 0.5 : 1,
                },
                action.style,
              ]}
              accessibilityRole="button"
            >
              {action.icon}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
});

DetailHeaderBar.displayName = 'DetailHeaderBar';
