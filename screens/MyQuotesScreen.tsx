import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import QuoteCard from '../components/QuoteCard';
import { mockQuotes } from '../data/mockData';

export default function MyQuotesScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: 16 }]}>
        <Text style={styles.headerTitle}>Mes Citations</Text>
        <Text style={styles.headerSubtitle}>{mockQuotes.length} citations sauvegardées</Text>
      </View>

      {/* Feed */}
      <ScrollView 
        style={styles.feed}
        contentContainerStyle={[
          styles.feedContent,
          { paddingBottom: insets.bottom + 20 }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {mockQuotes.map((quote) => (
          <QuoteCard
            key={quote.id}
            quote={quote}
            onBookPress={(bookId) => console.log('Book:', bookId)}
            onAuthorPress={(authorId) => console.log('Author:', authorId)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F1F',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 32,
    marginBottom: 4,
  },
  headerSubtitle: {
    color: '#6A6A6A',
    fontSize: 14,
  },
  feed: {
    flex: 1,
  },
  feedContent: {
    padding: 20,
  },
});
```

---

📄 8. src/screens/ScanScreen.tsx

```tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';

export default function ScanScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: 16 }]}>
        <Text style={styles.headerTitle}>Scanner</Text>
      </View>

      {/* Scan Area */}
      <View style={styles.scanArea}>
        <View style={styles.scanFrame}>
          <View style={[styles.corner, styles.cornerTopLeft]} />
          <View style={[styles.corner, styles.cornerTopRight]} />
          <View style={[styles.corner, styles.cornerBottomLeft]} />
          <View style={[styles.corner, styles.cornerBottomRight]} />
          
          <Icon name="camera" size={64} color="#20B8CD" />
          <Text style={styles.scanText}>Placez la citation dans le cadre</Text>
          <Text style={styles.scanSubtext}>L'OCR détectera automatiquement le texte</Text>
        </View>
      </View>

      {/* Bottom Actions */}
      <View style={[styles.bottomActions, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity style={styles.galleryButton}>
          <Icon name="image" size={24} color="#FFFFFF" />
          <Text style={styles.galleryButtonText}>Galerie</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.captureButton}>
          <View style={styles.captureButtonInner} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.flashButton}>
          <Icon name="zap" size={24} color="#FFFFFF" />
          <Text style={styles.flashButtonText}>Flash</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F1F',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 32,
    textAlign: 'center',
  },
  scanArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  scanFrame: {
    width: '100%',
    aspectRatio: 3 / 4,
    maxHeight: 500,
    borderWidth: 2,
    borderColor: '#20B8CD',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    backgroundColor: 'rgba(32, 184, 205, 0.05)',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#20B8CD',
  },
  cornerTopLeft: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 20,
  },
  cornerTopRight: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 20,
  },
  cornerBottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 20,
  },
  cornerBottomRight: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 20,
  },
  scanText: {
    color: '#FFFFFF',
    fontSize: 18,
    marginTop: 20,
    textAlign: 'center',
  },
  scanSubtext: {
    color: '#6A6A6A',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  bottomActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  galleryButton: {
    alignItems: 'center',
    gap: 4,
  },
  galleryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#20B8CD',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
  },
  flashButton: {
    alignItems: 'center',
    gap: 4,
  },
  flashButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
});