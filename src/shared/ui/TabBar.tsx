import React from 'react';
import { View, StyleSheet, ViewStyle, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '@/src/app/providers/ThemeContext';

export interface TabItem {
  id: string;
  label: string;
}

export interface TabBarProps {
  tabs: TabItem[];
  activeTab: string;
  onTabPress: (tabId: string) => void;
  style?: ViewStyle;
  scrollable?: boolean;
}

export const TabBar: React.FC<TabBarProps> = React.memo(({
  tabs,
  activeTab,
  onTabPress,
  style,
  scrollable = false,
}) => {
  const { colors } = useTheme();

  const content = tabs.map((tab) => {
    const isActive = activeTab === tab.id;
    return (
      <TouchableOpacity
        key={tab.id}
        style={[
          styles.tab,
          scrollable && styles.scrollableTab,
          isActive && [styles.activeTab, { borderBottomColor: colors.primary }]
        ]}
        onPress={() => onTabPress(tab.id)}
        accessible={true}
        accessibilityRole="tab"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={`Filtrer par ${tab.label}`}
      >
        <Text
          numberOfLines={1}
          style={[
            styles.tabText,
            { color: isActive ? colors.primary : colors.textSecondary },
            isActive && styles.activeTabText
          ]}
        >
          {tab.label}
        </Text>
      </TouchableOpacity>
    );
  });

  if (scrollable) {
    return (
      <View style={[{ backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border }, style]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollableContent}
        >
          {content}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.tabsContainer, { backgroundColor: colors.background, borderBottomColor: colors.border }, style]}>
      {content}
    </View>
  );
});

TabBar.displayName = 'TabBar';

const styles = StyleSheet.create({
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    gap: 16,
  },
  scrollableContent: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    gap: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    alignItems: 'center',
  },
  scrollableTab: {
    flex: 0,
    paddingHorizontal: 8,
  },
  activeTab: {},
  tabText: {
    fontSize: 15,
    fontWeight: '500',
  },
  activeTabText: {
    fontWeight: '600',
  },
});
