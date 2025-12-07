import React, { useEffect } from 'react';
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { AppNavigator } from './AppNavigator';
import { StatusBar, NativeEventEmitter, NativeModules } from 'react-native';

function App() {
  // RN 0.75 émet onAnimatedValueUpdate même sans listeners; on ajoute un listener no-op pour éviter le warn.
  useEffect(() => {
    const emitter = new NativeEventEmitter(NativeModules.NativeAnimatedModule);
    const sub = emitter.addListener('onAnimatedValueUpdate', () => {});
    return () => sub.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <StatusBar barStyle="light-content" />
        <AppNavigator />
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

export default App;
