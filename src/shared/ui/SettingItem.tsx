import React from 'react';
import {
  TouchableOpacity,
  TouchableOpacityProps,
  View,
  ViewStyle,
  StyleSheet,
} from 'react-native';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { tokens as defaultTokens } from '@/src/shared/theme';
import { AppText } from './AppText';
import { IconButton } from './IconButton';
import { Switch, SwitchProps } from './Switch';

export type SettingItemType = 'chevron' | 'switch' | 'custom';

export interface SettingItemProps extends Omit<TouchableOpacityProps, 'onPress'> {
  icon: React.ReactNode;
  title: string;
  type?: SettingItemType;
  onPress?: () => void;
  rightText?: string;
  rightContent?: React.ReactNode;
  switchValue?: boolean;
  switchProps?: Partial<SwitchProps>;
  disabled?: boolean;
  containerStyle?: ViewStyle | ViewStyle[];
}

export const SettingItem: React.FC<SettingItemProps> = React.memo(({
  icon,
  title,
  type = 'chevron',
  onPress,
  rightText,
  rightContent,
  switchValue,
  switchProps,
  disabled = false,
  containerStyle,
  ...rest
}) => {
  const { colors, tokens = defaultTokens } = useTheme();

  const handlePress = () => {
    if (type === 'switch' || disabled) return;
    if (onPress) {
      onPress();
    }
  };

  return (
    <TouchableOpacity
      style={[styles.container, containerStyle]}
      onPress={handlePress}
      disabled={type === 'switch' || disabled}
      accessible={true}
      accessibilityLabel={title}
      accessibilityRole={type === 'switch' ? 'none' : 'button'}
      activeOpacity={0.7}
      {...rest}
    >
      <View style={styles.leftContainer}>
        <View style={[styles.iconContainer, { backgroundColor: colors.primaryLight }]}>
          {icon}
        </View>
        <AppText variant="body" weight="regular" style={styles.title}>
          {title}
        </AppText>
      </View>

      {type === 'switch' && switchValue !== undefined && (
        <Switch
          value={switchValue}
          onValueChange={onPress}
          disabled={disabled}
          {...switchProps}
        />
      )}

      {type === 'chevron' && (
        <View style={styles.rightContainer}>
          {rightText && (
            <AppText variant="bodySmall" color="tertiary" style={styles.rightText}>
              {rightText}
            </AppText>
          )}
          <IconButton
            icon={<ChevronLeft size={20} color={colors.textTertiary} />}
            variant="ghost"
            size="sm"
            onPress={onPress}
            disabled={disabled}
            style={[{ transform: [{ rotate: '180deg' }] }, disabled ? { opacity: 0.5 } : {}]}
          />
        </View>
      )}

      {type === 'custom' && rightContent && (
        <View style={styles.rightContainer}>
          {rightContent}
        </View>
      )}
    </TouchableOpacity>
  );
});

SettingItem.displayName = 'SettingItem';

// Import ChevronLeft from lucide-react-native for the chevron icon
import { ChevronLeft } from 'lucide-react-native';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    minHeight: 56,
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    flex: 1,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rightText: {
    marginRight: 4,
  },
});
