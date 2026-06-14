import React from 'react';
import { StyleSheet, Text, View, StyleProp, TextStyle } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { User } from '@/src/shared/api/types';

interface UserAvatarProps {
  user: Partial<User> | null | undefined;
  size?: number;
  style?: StyleProp<any>;
  textStyle?: StyleProp<TextStyle>;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({ user, size = 40, style, textStyle }) => {
  const { colors } = useTheme();

  if (!user) {
    return (
      <View
        style={[
          styles.avatar,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colors.surfaceHighlight,
            justifyContent: 'center',
            alignItems: 'center',
          },
          style,
        ]}
      >
        <Text style={[{ color: colors.textTertiary, fontSize: size * 0.45, fontWeight: 'bold' }, textStyle]}>
          ?
        </Text>
      </View>
    );
  }

  const nameOrUsername = user.name || user.username || '?';
  const cleanName = nameOrUsername.startsWith('@') ? nameOrUsername.slice(1) : nameOrUsername;
  const initial = cleanName.trim().substring(0, 1).toUpperCase() || '?';

  if (user.image) {
    return (
      <Image
        source={{ uri: user.image }}
        style={[
          styles.avatar,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
          style,
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.avatar,
        styles.placeholder,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.primaryLight,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.placeholderText,
          {
            color: colors.primary,
            fontSize: size * 0.45,
          },
          textStyle,
        ]}
      >
        {initial}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  avatar: {
    overflow: 'hidden',
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontWeight: 'bold',
  },
});
