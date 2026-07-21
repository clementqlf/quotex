import React, { useState } from 'react';
import { Alert, TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '@/src/app/providers/AuthContext';
import { logError } from '@/src/shared/infrastructure/monitoring/sentry';
import { Trash2 } from 'lucide-react-native';

export const DeleteAccountButton = () => {
  const [isDeleting, setIsDeleting] = useState(false);
  const { deleteAccount } = useAuth(); 

  const handleDeleteRequest = async () => {
    try {
      setIsDeleting(true);
      await deleteAccount();
    } catch (error: any) {
      logError(error, { feature: 'account_deletion' });
      Alert.alert(
        'Erreur',
        'Impossible de supprimer le compte pour le moment. Veuillez réessayer.'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmDeletion = () => {
    Alert.alert(
      'Supprimer le compte',
      'Cette action est irréversible. Toutes vos citations et données seront définitivement effacées. Continuer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: handleDeleteRequest },
      ]
    );
  };

  return (
    <TouchableOpacity 
      style={styles.button} 
      onPress={confirmDeletion}
      disabled={isDeleting}
      accessibilityRole="button"
      accessibilityLabel="Supprimer définitivement mon compte"
      testID="delete-account-button"
    >
      {isDeleting ? (
        <ActivityIndicator color="#FF4B4B" />
      ) : (
        <>
          <Trash2 size={20} color="#FF4B4B" />
          <Text style={styles.text}>Supprimer mon compte</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 75, 75, 0.1)',
    marginHorizontal: 16,
    marginTop: 16,
  },
  text: {
    color: '#FF4B4B',
    fontWeight: '600',
    fontSize: 16,
  },
});
