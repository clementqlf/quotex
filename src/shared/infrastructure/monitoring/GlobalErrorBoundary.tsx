import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { AppText } from '@/src/shared/ui';
import { logError } from './sentry';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    // Met à jour l'état pour afficher l'UI de secours au prochain rendu
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Envoyer silencieusement l'erreur au tracker (ex: Sentry)
    logError(error, { errorInfo });
    console.error("Erreur interceptée par ErrorBoundary:", error, errorInfo);
  }

  private handleReset = () => {
    // Permet à l'utilisateur de tenter de recharger la vue
    this.setState({ hasError: false });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <AppText style={styles.title}>Oups ! Une erreur inattendue est survenue.</AppText>
          <AppText style={styles.subtitle}>Nous avons été alertés du problème.</AppText>
          <TouchableOpacity style={styles.button} onPress={this.handleReset}>
            <AppText style={styles.buttonText}>Rafraîchir</AppText>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 20, textAlign: 'center' },
  button: { padding: 12, backgroundColor: '#000', borderRadius: 8 },
  buttonText: { color: 'white', fontWeight: 'bold' }
});
