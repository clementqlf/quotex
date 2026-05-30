import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

type ScreenFallbackProps = {
  size?: 'small' | 'large';
};

export const ScreenFallback = ({ size = 'large' }: ScreenFallbackProps) => {
  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
