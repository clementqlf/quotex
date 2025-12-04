import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { QuoteDetailModal, Quote, User } from './QuoteDetailModal';
import { RootStackParamList } from '../types';

// Définir le type pour les paramètres de la route
type QuoteDetailScreenRouteProp = RouteProp<RootStackParamList, 'QuoteDetail'>;

export function QuoteDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<QuoteDetailScreenRouteProp>();
  // On récupère la citation et la fonction pour gérer le "like" directement
  // depuis les paramètres de navigation. Le composant ne gère plus d'état.
  const { quote, onToggleLike } = route.params;

  return (
    <View style={styles.container}>
      {/* Cette zone cliquable permet de fermer la modale en touchant l'arrière-plan */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={() => navigation.goBack()}
      />
      <QuoteDetailModal
        quote={quote}
        onClose={() => navigation.goBack()}
        onAuthorPress={(authorName: string) => { 
          navigation.navigate('AuthorDetail', { authorName });
        }}
        onBookPress={(bookTitle: string) => { 
          navigation.navigate('BookDetail', { bookTitle });
        }}
        onToggleLike={onToggleLike}
      />
    </View>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.7)' },
});