import { ThemeColors } from '@/src/shared/theme';
import React from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

export const BookDetailSkeleton = ({ colors }: { colors: ThemeColors }) => {
  const opacity = useSharedValue(0.3);

  React.useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 1000 }),
        withTiming(0.3, { duration: 1000 })
      ),
      -1,
      true
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
      <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.surfaceHighlight, marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <Animated.View style={[{ width: 100, height: 150, borderRadius: 8, backgroundColor: colors.surfaceHighlight }, animatedStyle]} />
          <View style={{ flex: 1, justifyContent: 'center', gap: 10 }}>
            <Animated.View style={[{ width: '85%', height: 24, borderRadius: 6, backgroundColor: colors.surfaceHighlight }, animatedStyle]} />
            <Animated.View style={[{ width: '55%', height: 16, borderRadius: 6, backgroundColor: colors.surfaceHighlight }, animatedStyle]} />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <Animated.View style={[{ width: 56, height: 26, borderRadius: 999, backgroundColor: colors.surfaceHighlight }, animatedStyle]} />
              <Animated.View style={[{ width: 72, height: 26, borderRadius: 999, backgroundColor: colors.surfaceHighlight }, animatedStyle]} />
            </View>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <Animated.View style={[{ width: 42, height: 14, borderRadius: 4, backgroundColor: colors.surfaceHighlight }, animatedStyle]} />
              <Animated.View style={[{ width: 42, height: 14, borderRadius: 4, backgroundColor: colors.surfaceHighlight }, animatedStyle]} />
              <Animated.View style={[{ width: 54, height: 14, borderRadius: 4, backgroundColor: colors.surfaceHighlight }, animatedStyle]} />
            </View>
          </View>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
        <Animated.View style={[{ flex: 1, height: 40, borderRadius: 999, backgroundColor: colors.surfaceHighlight }, animatedStyle]} />
        <Animated.View style={[{ flex: 1, height: 40, borderRadius: 999, backgroundColor: colors.surfaceHighlight }, animatedStyle]} />
      </View>

      <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: colors.surfaceHighlight, marginBottom: 16 }}>
        <Animated.View style={[{ width: 160, height: 18, borderRadius: 6, backgroundColor: colors.surfaceHighlight, marginBottom: 12 }, animatedStyle]} />
        <View style={{ gap: 10 }}>
          <Animated.View style={[{ width: '100%', height: 96, borderRadius: 12, backgroundColor: colors.surfaceHighlight }, animatedStyle]} />
          <Animated.View style={[{ width: '100%', height: 82, borderRadius: 12, backgroundColor: colors.surfaceHighlight }, animatedStyle]} />
          <Animated.View style={[{ width: '100%', height: 64, borderRadius: 12, backgroundColor: colors.surfaceHighlight }, animatedStyle]} />
        </View>
      </View>

      <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: colors.surfaceHighlight }}>
        <Animated.View style={[{ width: 140, height: 18, borderRadius: 6, backgroundColor: colors.surfaceHighlight, marginBottom: 12 }, animatedStyle]} />
        <View style={{ gap: 10 }}>
          <Animated.View style={[{ width: '100%', height: 88, borderRadius: 12, backgroundColor: colors.surfaceHighlight }, animatedStyle]} />
          <Animated.View style={[{ width: '100%', height: 88, borderRadius: 12, backgroundColor: colors.surfaceHighlight }, animatedStyle]} />
        </View>
      </View>
    </ScrollView>
  );
};
