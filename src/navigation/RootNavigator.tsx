typescript
import React, { useRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import PagerView from 'react-native-pager-view';
import { MyQuotesScreen } from '../screens/MyQuotesScreen';
import { ScanScreen } from '../screens/ScanScreen';
import { SocialFeedScreen } from '../screens/SocialFeedScreen';

const { width } = Dimensions.get('window');

export function RootNavigator() {
  const pagerRef = useRef<PagerView>(null);

  return (
    <View style={styles.container}>
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={1} // Start on ScanScreen (middle)
        orientation="horizontal"
      >
        {/* Left: My Quotes */}
        <View key="1" style={styles.page}>
          <MyQuotesScreen />
        </View>

        {/* Center: Scan */}
        <View key="2" style={styles.page}>
          <ScanScreen />
        </View>

        {/* Right: Social Feed */}
        <View key="3" style={styles.page}>
          <SocialFeedScreen />
        </View>
      </PagerView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  pager: {
    flex: 1,
  },
  page: {
    width,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
```

---

7️⃣ App.tsx (Point d'entrée principal)

```typescript
import React from 'react';
import { StatusBar } from 'react-native';
import { RootNavigator } from './src/navigation/RootNavigator';

function App(): React.JSX.Element {
  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#0F0F0F" />
      <RootNavigator />
    </>
  );
}

export default App;
