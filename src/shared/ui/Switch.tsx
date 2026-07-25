import React from 'react';
import { Switch as RNSwitch, SwitchProps as RNSwitchProps, ViewStyle } from 'react-native';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { tokens as defaultTokens } from '@/src/shared/theme';
import { useHaptics } from '@/src/shared/platform';

export interface SwitchProps extends RNSwitchProps {
  enableHaptics?: boolean;
  containerStyle?: ViewStyle | ViewStyle[];
}

export const Switch: React.FC<SwitchProps> = React.memo(({
  value = false,
  onValueChange,
  disabled = false,
  enableHaptics = true,
  containerStyle,
  trackColor,
  thumbColor,
  ...rest
}) => {
  const { colors, tokens = defaultTokens } = useTheme();
  const haptics = useHaptics();

  const handleValueChange = async (newValue: boolean) => {
    if (disabled) return;
    
    if (enableHaptics) {
      try {
        await haptics.impactAsync('light');
      } catch (err) {
        // Ignore haptics errors on unsupported platforms
      }
    }
    
    if (onValueChange) {
      onValueChange(newValue);
    }
  };

  // Default track colors using theme
  const defaultTrackColor = {
    false: colors.border || '#767577',
    true: colors.primary,
  };

  // Default thumb colors using theme
  const defaultThumbColor = value ? '#FFFFFF' : (colors.surfaceHighlight || '#f4f3f4');

  return (
    <RNSwitch
      value={value}
      onValueChange={handleValueChange}
      disabled={disabled}
      trackColor={trackColor || defaultTrackColor}
      thumbColor={thumbColor || defaultThumbColor}
      ios_backgroundColor={defaultTrackColor.false}
      style={containerStyle}
      {...rest}
    />
  );
});

Switch.displayName = 'Switch';
