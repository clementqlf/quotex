import React from 'react';
import { StyleSheet, Text, View, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { Image } from 'expo-image';
import { Book, BookOpen, BookCopy } from 'lucide-react-native';
import { useTheme } from '@/src/app/providers/ThemeContext';

interface BookCoverProps {
  uri?: string | null;
  title?: string;
  width?: number;
  height?: number;
  borderRadius?: number;
  showTitleFallback?: boolean;
  fallbackIcon?: 'book' | 'bookOpen' | 'bookCopy' | 'none';
  fallbackIconColor?: string;
  style?: StyleProp<any>;
  textStyle?: StyleProp<TextStyle>;
}

export const BookCover: React.FC<BookCoverProps> = React.memo(({
  uri,
  title,
  width = 60,
  height = 90,
  borderRadius = 4,
  showTitleFallback = false,
  fallbackIcon = 'bookOpen',
  fallbackIconColor,
  style,
  textStyle,
}) => {
  const { colors } = useTheme();

  const containerStyle = {
    width,
    height,
    borderRadius,
    overflow: 'hidden' as const,
  };

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[containerStyle, style]}
      />
    );
  }

  // Render the appropriate fallback icon
  const renderIcon = () => {
    const iconSize = Math.min(width * 0.4, 24);
    const iconColor = fallbackIconColor || colors.textTertiary;

    switch (fallbackIcon) {
      case 'book':
        return <Book size={iconSize} color={iconColor} />;
      case 'bookCopy':
        return <BookCopy size={iconSize} color={iconColor} />;
      case 'bookOpen':
        return <BookOpen size={iconSize} color={iconColor} />;
      default:
        return null;
    }
  };

  // Fallback view
  return (
    <View
      style={[
        containerStyle,
        {
          backgroundColor: colors.surfaceHighlight,
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: colors.border,
          padding: 6,
        },
        style,
      ]}
    >
      {renderIcon()}
      {showTitleFallback && title ? (
        <Text
          numberOfLines={3}
          style={[
            {
              fontSize: Math.max(Math.min(width * 0.12, 11), 8),
              color: colors.textSecondary,
              textAlign: 'center',
              marginTop: 6,
              fontWeight: '500',
            },
            textStyle,
          ]}
        >
          {title}
        </Text>
      ) : null}
    </View>
  );
});

BookCover.displayName = 'BookCover';
