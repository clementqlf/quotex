import React from 'react';
import { TextStyle } from 'react-native';
import { Badge, BadgeProps } from './Badge';

/**
 * DebugBadge - A badge that only renders in development mode
 * Used to identify data sources during development
 */
export interface DebugBadgeProps extends Omit<BadgeProps, 'label' | 'variant' | 'size' | 'textStyle'> {
  label: string;
  color?: 'error' | 'info' | 'warning' | 'success';
}

export const DebugBadge: React.FC<DebugBadgeProps> = ({
  label,
  color = 'error',
  ...rest
}) => {
  if (!__DEV__) return null;

  // Map color to variant and text style
  let variant: BadgeProps['variant'] = 'outline';
  let textStyle: TextStyle = { fontSize: 10, fontWeight: 'bold' };

  switch (color) {
    case 'error':
      textStyle = { ...textStyle, color: '#EF4444' };
      break;
    case 'info':
      textStyle = { ...textStyle, color: '#3B82F6' };
      break;
    case 'warning':
      textStyle = { ...textStyle, color: '#F59E0B' };
      break;
    case 'success':
      textStyle = { ...textStyle, color: '#10B981' };
      break;
  }

  return (
    <Badge
      label={label}
      variant={variant}
      size="sm"
      style={{ marginLeft: 8 }}
      textStyle={textStyle}
      {...rest}
    />
  );
};

DebugBadge.displayName = 'DebugBadge';
