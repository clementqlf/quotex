import React from 'react';
import {
  TouchableOpacity,
  TouchableOpacityProps,
  View,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { useTheme } from '@/src/app/providers/ThemeContext';

export type CircleButtonSize = 'sm' | 'md' | 'lg';

export interface CircleButtonProps extends Omit<TouchableOpacityProps, 'onPress'> {
  icon: React.ReactNode;
  onPress: () => void;
  size?: CircleButtonSize;
  disabled?: boolean;
  active?: boolean;
  color?: string;
  inactiveColor?: string;
  disabledColor?: string;
  shadowColor?: string;
  style?: ViewStyle | ViewStyle[];
}

const SIZES = {
  sm: { diameter: 48, iconSize: 20 },
  md: { diameter: 84, iconSize: 28 },
  lg: { diameter: 110, iconSize: 36 },
};

export const CircleButton: React.FC<CircleButtonProps> = ({
  icon,
  onPress,
  size = 'md',
  disabled = false,
  active = false,
  color: customColor,
  inactiveColor: customInactiveColor,
  disabledColor: customDisabledColor,
  shadowColor: customShadowColor,
  style,
  ...rest
}) => {
  const { colors } = useTheme();
  
  const { diameter } = SIZES[size];
  const radius = diameter / 2;
  
  // Couleurs par défaut basées sur le thème
  const borderColor = customColor || colors.primary;
  const inactiveBorderColor = customInactiveColor || colors.textTertiary;
  const disabledBorderColor = customDisabledColor || colors.border;
  const shadowColor = customShadowColor || colors.primary;

  return (
    <TouchableOpacity
      style={[
        styles.base,
        {
          width: diameter,
          height: diameter,
          borderRadius: radius,
          borderWidth: 3,
          borderColor: disabled ? disabledBorderColor : (active ? borderColor : inactiveBorderColor),
          backgroundColor: active ? 'rgba(32, 184, 205, 0.2)' : 'transparent',
          shadowColor: disabled ? 'transparent' : shadowColor,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: disabled ? 0 : 1,
          shadowRadius: 15,
          elevation: disabled ? 0 : 8,
        },
        style,
      ]}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      activeOpacity={0.9}
      accessible={true}
      accessibilityRole="button"
      {...rest}
    >
      <View style={styles.iconContainer}>{icon}</View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

CircleButton.displayName = 'CircleButton';
