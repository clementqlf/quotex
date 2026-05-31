import React from 'react';
import { render } from '@testing-library/react-native';
import { ActivityIndicator } from 'react-native';
import { ScreenFallback } from '../ScreenFallback';

describe('ScreenFallback Component', () => {
  it('renders correctly with default size (large)', () => {
    const { root } = render(<ScreenFallback />);
    
    // Vérifie que l'ActivityIndicator est bien rendu
    const activityIndicator = root.findByType(ActivityIndicator);
    expect(activityIndicator).toBeTruthy();
    expect(activityIndicator.props.size).toBe('large');
  });

  it('renders correctly with custom size (small)', () => {
    const { root } = render(<ScreenFallback size="small" />);
    
    // Vérifie que la propriété size est correctement passée
    const activityIndicator = root.findByType(ActivityIndicator);
    expect(activityIndicator.props.size).toBe('small');
  });
});
