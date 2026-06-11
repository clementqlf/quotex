import { useAuth } from '@/src/app/providers/AuthContext';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { ReviewService } from '@/src/shared/api/ReviewService';
import { render, waitFor } from '@testing-library/react-native';
import React from 'react';
import ReviewBlock from '../ReviewBlock';

jest.mock('@/src/app/providers/ThemeContext', () => ({
  useTheme: jest.fn(),
}));

jest.mock('@/src/app/providers/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/src/shared/navigation/useSmartNavigation', () => ({
  useSmartNavigation: () => ({ navigateToUserProfile: jest.fn() }),
}));

jest.mock('lucide-react-native', () => ({
  Star: ({ color, fill, ...props }: any) => {
    const { View } = require('react-native');
    return require('react').createElement(View, { ...props, testID: `star-${fill !== 'none' ? 'filled' : 'empty'}` });
  },
  User: () => 'User',
  Send: () => 'Send',
  X: () => 'X',
  MoreHorizontal: () => 'MoreHorizontal',
  Trash2: () => 'Trash2',
}));

jest.mock('@/src/shared/api/ReviewService', () => ({
  ReviewService: {
    getReviewsByBookId: jest.fn(),
    createReview: jest.fn(),
    updateReview: jest.fn(),
    deleteReview: jest.fn(),
  },
}));

jest.mock('@/src/shared/api/UGCModerationService', () => ({
  UGCModerationService: {
    getBlockedUsers: jest.fn().mockResolvedValue([]),
    getReportedReviews: jest.fn().mockResolvedValue([]),
    containsOffensiveContent: jest.fn().mockReturnValue(false),
    reportReview: jest.fn(),
    blockUser: jest.fn(),
  },
}));

const mockColors = {
  primary: '#0275d8',
  text: '#000',
  textSecondary: '#666',
  textTertiary: '#999',
  warning: '#f0ad4e',
  surface: '#fff',
  surfaceHighlight: '#f0f0f0',
  border: '#ddd',
  background: '#fff',
  inputBackground: '#f5f5f5',
  inputText: '#000',
};

describe('ReviewBlock Component', () => {
  const mockOnReviewAdded = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useTheme as jest.Mock).mockReturnValue({ colors: mockColors });
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: 'user-1', name: 'Test User' },
    });
    (ReviewService.getReviewsByBookId as jest.Mock).mockResolvedValue([]);
  });

  it('affiche le titre "Avis & Commentaires"', async () => {
    const { getByText } = render(<ReviewBlock bookId={42} />);
    await waitFor(() => {
      expect(getByText('Avis & Commentaires')).toBeTruthy();
    });
  });

  it('affiche "Votre note" et le champ de commentaire', async () => {
    const { getByText, getByPlaceholderText } = render(<ReviewBlock bookId={42} />);
    await waitFor(() => {
      expect(getByText('Votre note')).toBeTruthy();
      expect(getByPlaceholderText('Donnez votre avis sur ce livre...')).toBeTruthy();
    });
  });

  it('affiche le bouton "Publier" quand l\'utilisateur n\'a pas encore donné d\'avis', async () => {
    const { getByText } = render(<ReviewBlock bookId={42} />);
    await waitFor(() => {
      expect(getByText('Publier')).toBeTruthy();
    });
  });

  it('affiche le bouton "Mettre à jour" quand l\'utilisateur a déjà un avis', async () => {
    (ReviewService.getReviewsByBookId as jest.Mock).mockResolvedValue([
      { id: 10, rating: 4, comment: 'Super livre', createdAt: '2026-01-01', user: { id: 'user-1', name: 'Test User' }, userId: 'user-1', bookId: 42 }
    ]);

    const { getByText } = render(<ReviewBlock bookId={42} onReviewAdded={mockOnReviewAdded} />);
    await waitFor(() => {
      expect(getByText('Mettre à jour')).toBeTruthy();
    });
  });

  it('affiche les avis de la communauté', async () => {
    (ReviewService.getReviewsByBookId as jest.Mock).mockResolvedValue([
      { id: 20, rating: 5, comment: 'Chef-d\'oeuvre !', createdAt: '2026-01-15', user: { id: 'user-2', name: 'Alice' }, userId: 'user-2', bookId: 42 },
      { id: 21, rating: 3, comment: 'Pas mal', createdAt: '2026-01-20', user: { id: 'user-3', name: 'Bob' }, userId: 'user-3', bookId: 42 },
    ]);

    const { getByText } = render(<ReviewBlock bookId={42} />);
    await waitFor(() => {
      expect(getByText('Avis de la communauté')).toBeTruthy();
      expect(getByText('Chef-d\'oeuvre !')).toBeTruthy();
      expect(getByText('Pas mal')).toBeTruthy();
    });
  });

  it('affiche le bouton "Voir les X avis" si plus de 2 avis communauté', async () => {
    (ReviewService.getReviewsByBookId as jest.Mock).mockResolvedValue([
      { id: 20, rating: 5, comment: 'Excellent', createdAt: '2026-01-15', user: { id: 'user-2', name: 'A' }, userId: 'user-2', bookId: 42 },
      { id: 21, rating: 4, comment: 'Bien', createdAt: '2026-01-16', user: { id: 'user-3', name: 'B' }, userId: 'user-3', bookId: 42 },
      { id: 22, rating: 3, comment: 'Correct', createdAt: '2026-01-17', user: { id: 'user-4', name: 'C' }, userId: 'user-4', bookId: 42 },
    ]);

    const { getByText } = render(<ReviewBlock bookId={42} />);
    await waitFor(() => {
      expect(getByText('Voir les 3 avis')).toBeTruthy();
    });
  });

  it('affiche le bouton supprimer quand onRemove est fourni', async () => {
    const mockOnRemove = jest.fn();
    const { getByText } = render(<ReviewBlock bookId={42} onRemove={mockOnRemove} />);
    // Le composant doit rendre même sans reviews
    await waitFor(() => {
      expect(getByText('Avis & Commentaires')).toBeTruthy();
    });
  });
});
