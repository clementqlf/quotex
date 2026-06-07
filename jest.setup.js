// Mock d'AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock de expo-image
jest.mock('expo-image', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Image: (props) => <View {...props} testID="mock-image" />,
  };
});

// Mock de lucide-react-native
jest.mock('lucide-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    ChevronDown: (props) => <View {...props} testID="mock-chevron-down" />,
  };
});

// Mock global pour fetch (utile pour tester les services API)
global.fetch = jest.fn();

// Mock expo-constants pour les tests Supabase
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      supabaseUrl: 'https://mock.supabase.co',
      supabaseAnonKey: 'mock-anon-key',
    },
  },
}));

// Configurer les variables d'environnement pour les tests Jest
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://mock.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key';
process.env.EXPO_PUBLIC_API_BASE_URL = 'https://mock.supabase.co/functions/v1';

// Mock Google Signin
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn().mockResolvedValue({ user: { id: 'mock-google-id' } }),
    signOut: jest.fn().mockResolvedValue(true),
    revokeAccess: jest.fn().mockResolvedValue(true),
    isSignedIn: jest.fn().mockResolvedValue(true),
  },
}));

// Mock expo-network
jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn().mockResolvedValue({
    isConnected: true,
    isInternetReachable: true,
  }),
}));
