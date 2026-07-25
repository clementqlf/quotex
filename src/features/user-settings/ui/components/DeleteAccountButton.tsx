import React, { useState } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { useAuth } from '@/src/app/providers/AuthContext';
import { logError } from '@/src/shared/infrastructure/monitoring/sentry';
import { Button } from '@/src/shared/ui';
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
    <Button
      title="Supprimer mon compte"
      variant="danger"
      leftIcon={<Trash2 size={20} />}
      isLoading={isDeleting}
      disabled={isDeleting}
      onPress={confirmDeletion}
      style={styles.button}
      accessibilityLabel="Supprimer définitivement mon compte"
      testID="delete-account-button"
    />
  );
};

const styles = StyleSheet.create({
  button: {
    marginHorizontal: 16,
    marginTop: 16,
  },
});
