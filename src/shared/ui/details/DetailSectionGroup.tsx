import React from 'react';
import { View, TouchableOpacity, ViewStyle } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { tokens as defaultTokens } from '@/src/shared/theme';
import { AppText } from '../AppText';
import { TabBar } from '../TabBar';

export interface DetailTabItem {
  id: string;
  label: string;
}

export interface DetailSectionGroupProps {
  tabs?: DetailTabItem[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  title?: string;
  onAddBlockPress?: () => void;
  addBlockLabel?: string;
  children?: React.ReactNode;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
}

/**
 * Conteneur de section partagé pour les pages de détail (BookDetail, AuthorDetail, QuoteDetail).
 * Inclus la gestion optionnelle des onglets, du titre de section, et du bouton "Ajouter un bloc".
 */
export const DetailSectionGroup: React.FC<DetailSectionGroupProps> = React.memo(({
  tabs,
  activeTab,
  onTabChange,
  title,
  onAddBlockPress,
  addBlockLabel = 'Ajouter un bloc',
  children,
  style,
  contentStyle,
}) => {
  const { colors, tokens = defaultTokens } = useTheme();

  return (
    <View style={style}>
      {/* 1. Système d'onglets (Optionnel) */}
      {tabs && tabs.length > 0 && activeTab && onTabChange && (
        <TabBar
          tabs={tabs}
          activeTab={activeTab}
          onTabPress={onTabChange}
          style={{ paddingHorizontal: 0, paddingBottom: 0, marginBottom: tokens.spacing.md, backgroundColor: 'transparent' }}
        />
      )}

      {/* 2. Titre de la section (Optionnel) */}
      {title && (
        <View style={{ marginBottom: tokens.spacing.sm }}>
          <AppText variant="body" weight="semibold" customColor={colors.text}>
            {title}
          </AppText>
        </View>
      )}

      {/* 3. Contenu de la grille / des blocs */}
      <View style={contentStyle}>{children}</View>

      {/* 4. Bouton d'ajout de bloc (Optionnel) */}
      {onAddBlockPress && (
        <TouchableOpacity
          onPress={onAddBlockPress}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: tokens.spacing.xs,
            paddingVertical: tokens.spacing.md,
            paddingHorizontal: tokens.spacing.lg,
            borderWidth: 1,
            borderColor: colors.border,
            borderStyle: 'dashed',
            borderRadius: tokens.radii.md || 8,
            backgroundColor: colors.surfaceHighlight || colors.surface,
            marginTop: tokens.spacing.md,
          }}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={addBlockLabel}
        >
          <Plus size={18} color={colors.textSecondary} />
          <AppText variant="bodySmall" weight="medium" customColor={colors.textSecondary}>
            {addBlockLabel}
          </AppText>
        </TouchableOpacity>
      )}
    </View>
  );
});

DetailSectionGroup.displayName = 'DetailSectionGroup';
