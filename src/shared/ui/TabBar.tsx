import React from 'react';
import { View, StyleSheet, ViewStyle, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { tokens as defaultTokens } from '@/src/shared/theme';

export interface TabItem {
  id: string;
  label: string;
}

export interface TabBarProps {
  tabs: TabItem[];
  activeTab: string;
  onTabPress: (tabId: string) => void;
  style?: ViewStyle;
}

export const TabBar: React.FC<TabBarProps> = React.memo(({
  tabs,
  activeTab,
  onTabPress,
  style,
}) => {
  const { colors, tokens = defaultTokens } = useTheme();

  return (
    <View style={[styles.tabsContainer, { backgroundColor: colors.background, borderBottomColor: colors.border }, style]}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.id}
          style={[styles.tab, activeTab === tab.id && styles.activeTab]}
          onPress={() => onTabPress(tab.id)}
          accessible={true}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === tab.id }}
          accessibilityLabel={`Filtrer par ${tab.label}`}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === tab.id && [styles.activeTabText, { color: colors.primary }]
            ]}
          >
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
});

TabBar.displayName = 'TabBar';

const styles = StyleSheet.create({
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginRight: 24,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    alignItems: 'center',
  },
  activeTab: {
    borderBottomColor: '#20B8CD',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
  },
  activeTabText: {
    fontWeight: '600',
  },
});
