import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  PanResponder,
} from 'react-native';
import { BookOpen, ChevronRight, X } from 'lucide-react-native';

export type IsbnBookData = {
  title: string;
  author: string;
  cover?: string;
  bookId?: string;
  inventaireUri?: string;
  bookData?: any;
};

type AnimatedISBNPopupProps = {
  bookData: IsbnBookData;
  onPress: () => void;
  onDismiss: () => void;
};

export default function AnimatedISBNPopup({
  bookData,
  onPress,
  onDismiss,
}: AnimatedISBNPopupProps) {
  const translateY = useRef(new Animated.Value(120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const isDismissing = useRef(false);

  useEffect(() => {
    // Entrée: slide up + fade in
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 18,
        stiffness: 200,
        mass: 0.8,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const dismiss = () => {
    if (isDismissing.current) return;
    isDismissing.current = true;
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 160,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onDismiss());
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        gestureState.dy > 8 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
      onPanResponderGrant: () => {
        dragY.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          dragY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 60) {
          dismiss();
        } else {
          Animated.spring(dragY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 20,
            stiffness: 300,
          }).start();
        }
      },
    })
  ).current;

  const combinedTranslate = Animated.add(translateY, dragY);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity,
          transform: [{ translateY: combinedTranslate }],
        },
      ]}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity
        style={styles.card}
        onPress={onPress}
        activeOpacity={0.85}
      >
        {/* Cover du livre */}
        <View style={styles.coverContainer}>
          {bookData.cover ? (
            <Image
              source={{ uri: bookData.cover }}
              style={styles.coverImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.coverPlaceholder}>
              <BookOpen size={28} color="#20B8CD" />
            </View>
          )}
        </View>

        {/* Infos du livre */}
        <View style={styles.infoContainer}>
          <View style={styles.isbnBadge}>
            <Text style={styles.isbnBadgeText}>ISBN détecté</Text>
          </View>
          <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
            {bookData.title}
          </Text>
          <Text style={styles.author} numberOfLines={1} ellipsizeMode="tail">
            {bookData.author}
          </Text>
          <View style={styles.openRow}>
            <Text style={styles.openText}>Voir le livre</Text>
            <ChevronRight size={14} color="#20B8CD" />
          </View>
        </View>

        {/* Bouton fermer */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={dismiss}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <X size={16} color="#9CA3AF" />
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Handle de swipe */}
      <View style={styles.swipeHandle} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 170,
    left: 20,
    right: 20,
    zIndex: 200,
    alignItems: 'center',
  },
  swipeHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginTop: 8,
  },
  card: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(18, 18, 18, 0.97)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(32, 184, 205, 0.35)',
    paddingVertical: 14,
    paddingHorizontal: 14,
    shadowColor: '#20B8CD',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  coverContainer: {
    width: 62,
    height: 88,
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: 14,
    flexShrink: 0,
    backgroundColor: '#1A1A1A',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(32, 184, 205, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(32, 184, 205, 0.2)',
    borderRadius: 10,
  },
  infoContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  isbnBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(32, 184, 205, 0.12)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(32, 184, 205, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 4,
  },
  isbnBadgeText: {
    color: '#20B8CD',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  author: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '400',
    marginTop: 2,
  },
  openRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 2,
  },
  openText: {
    color: '#20B8CD',
    fontSize: 12,
    fontWeight: '600',
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    alignSelf: 'flex-start',
  },
});
