import React from 'react';
import {
  TouchableOpacity,
  TouchableOpacityProps,
  ViewStyle,
} from 'react-native';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { useHaptics } from '@/src/shared/platform';

export type IconButtonVariant = 'ghost' | 'filled' | 'outline';
export type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps extends Omit<TouchableOpacityProps, 'children'> {
  icon: React.ReactNode;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  enableHaptics?: boolean;
  style?: ViewStyle | ViewStyle[];
}

export const IconButton: React.FC<IconButtonProps> = React.memo(({
  icon,
  variant = 'ghost',
  size = 'md',
  enableHaptics = true,
  disabled = false,
  onPress,
  style,
  ...rest
}) => {
  const { colors } = useTheme();
  const haptics = useHaptics();

  const handlePress = async (e: any) => {
    if (disabled) return;
    if (enableHaptics) {
      try {
        await haptics.impactAsync('light');
      } catch {
        // Ignore haptics errors on unsupported platforms
      }
    }
    if (onPress) {
      onPress(e);
    }
  };

  const getDimension = (): number => {
    switch (size) {
      case 'sm':
        return 32;
      case 'lg':
        return 48;
      case 'md':
      default:
        return 40;
    }
  };

  const getContainerStyle = (): ViewStyle => {
    const dim = getDimension();
    const baseStyle: ViewStyle = {
      width: dim,
      height: dim,
      borderRadius: dim / 2,
      alignItems: 'center',
      justifyContent: 'center',
    };

    switch (variant) {
      case 'filled':
        return {
          ...baseStyle,
          backgroundColor: colors.surfaceHighlight,
        };
      case 'outline':
        return {
          ...baseStyle,
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: colors.border,
        };
      case 'ghost':
      default:
        return {
          ...baseStyle,
          backgroundColor: 'transparent',
        };
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      disabled={disabled}
      onPress={handlePress}
      style={[
        getContainerStyle(),
        disabled && { opacity: 0.5 },
        style,
      ]}
      accessible={true}
      accessibilityRole="button"
      {...rest}
    >
      {icon}
    </TouchableOpacity>
  );
});

IconButton.displayName = 'IconButton';
