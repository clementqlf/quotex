// Shared tooltip component for react-native-copilot
// Placed in shared/ui so any layer (entity, feature, page) can use it
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useCopilot } from 'react-native-copilot';
import { useTheme } from '@/src/app/providers/ThemeContext';

export default function CustomTooltip() {
  const {
    isFirstStep,
    isLastStep,
    goToNext,
    goToPrev,
    stop,
    currentStep,
  } = useCopilot();
  const colors = useTheme().colors;

  const handleNext = async () => {
    if (isLastStep) {
      await stop();
    } else {
      await goToNext();
    }
  };

  const handlePrev = async () => {
    await goToPrev();
  };

  const handleStop = async () => {
    await stop();
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.surface, borderColor: colors.surfaceHighlight },
      ]}
    >
      {/* Header avec indicateur d'étape */}
      <View style={styles.header}>
        <Text style={[styles.stepBadge, { color: colors.primary, backgroundColor: colors.primaryLight }]}>
          Étape {currentStep?.order || 1}
        </Text>
        <TouchableOpacity onPress={handleStop} activeOpacity={0.7}>
          <Text style={[styles.skipText, { color: colors.textSecondary }]}>Passer</Text>
        </TouchableOpacity>
      </View>

      {/* Message descriptif */}
      <Text style={[styles.message, { color: colors.text }]}>
        {currentStep?.text || ''}
      </Text>

      {/* Pied de page avec boutons de navigation */}
      <View style={styles.footer}>
        {!isFirstStep ? (
          <TouchableOpacity
            style={[styles.button, styles.backButton, { borderColor: colors.border }]}
            onPress={handlePrev}
            activeOpacity={0.8}
          >
            <Text style={[styles.backButtonText, { color: colors.text }]}>Retour</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ flex: 1 }} />
        )}

        <TouchableOpacity
          style={[styles.button, styles.nextButton, { backgroundColor: colors.primary }]}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <Text style={[styles.nextButtonText, { color: colors.buttonText }]}>
            {isLastStep ? 'Terminer' : 'Suivant'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepBadge: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  skipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    marginBottom: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  button: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: {
    borderWidth: 1,
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  nextButton: {
    shadowColor: '#20B8CD',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  nextButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
