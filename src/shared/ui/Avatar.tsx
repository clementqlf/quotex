import React from 'react';
import { Text, View, StyleProp, TextStyle } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { User } from '@/src/shared/api/types';

interface AvatarProps {
  uri?: string | null;
  name?: string;
  user?: Partial<User> | null | undefined;
  size?: number;
  style?: StyleProp<any>;
  textStyle?: StyleProp<TextStyle>;
}

export const Avatar: React.FC<AvatarProps> = React.memo(({
  uri,
  name,
  user,
  size = 40,
  style,
  textStyle,
}) => {
  const { colors } = useTheme();

  // Extract uri and name from user prop if available
  const resolvedUri = user ? user.image : uri;
  const resolvedName = user ? (user.name || user.username) : name;

  const containerStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    overflow: 'hidden' as const,
  };

  if (resolvedUri) {
    return (
      <Image
        source={{ uri: resolvedUri }}
        style={[containerStyle, style]}
        cachePolicy="disk"
        transition={200}
      />
    );
  }

  // Fallback initial
  let initial = '?';
  if (resolvedName) {
    const cleanName = resolvedName.startsWith('@') ? resolvedName.slice(1) : resolvedName;
    initial = cleanName.trim().substring(0, 1).toUpperCase() || '?';
  }

  const fontSize = size * 0.45;

  return (
    <View
      style={[
        containerStyle,
        {
          backgroundColor: colors.primaryLight,
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: size > 50 ? 2 : 1,
          borderColor: colors.primary,
        },
        style,
      ]}
    >
      <Text
        style={[
          {
            fontSize,
            fontWeight: 'bold',
            color: colors.primary,
          },
          textStyle,
        ]}
      >
        {initial}
      </Text>
    </View>
  );
});

Avatar.displayName = 'Avatar';
