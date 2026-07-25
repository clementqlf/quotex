import React from 'react';
import { Alert, StyleSheet, ViewStyle } from 'react-native';
import { Button } from './Button';
import { Trash2 } from 'lucide-react-native';

interface DeleteAccountButtonProps {
  onPress: () => Promise<void>;
  isLoading?: boolean;
  title?: string;
  confirmTitle?: string;
  confirmMessage?: string;
  successMessage?: string;
  errorMessage?: string;
  style?: ViewStyle | ViewStyle[] | undefined;
}

export const DeleteAccountButton: React.FC<DeleteAccountButtonProps> = ({
  onPress,
  isLoading = false,
  title = 'Supprimer mon compte',
  confirmTitle = 'Supprimer le compte',
  confirmMessage = 'Cette action est irréversible. Toutes vos citations et données seront définitivement effacées. Continuer ?',
  successMessage,
  errorMessage = 'Impossible de supprimer le compte pour le moment. Veuillez réessayer.',
  style,
}) => {
  const handlePressWithConfirmation = () => {
    Alert.alert(
      confirmTitle,
      confirmMessage,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await onPress();
              if (successMessage) {
                Alert.alert('Succès', successMessage);
              }
            } catch {
              Alert.alert('Erreur', errorMessage);
            }
          },
        },
      ]
    );
  };

  return (
    <Button
      title={title}
      variant="danger"
      leftIcon={<Trash2 size={20} />}
      isLoading={isLoading}
      disabled={isLoading}
      onPress={handlePressWithConfirmation}
      style={[styles.button, style].filter(Boolean) as ViewStyle[]}
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
