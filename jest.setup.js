global.IS_REACT_ACT_ENVIRONMENT = true;

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

// Mock de lucide-react-native avec un Proxy dynamique pour tous les icônes
jest.mock('lucide-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  return new Proxy(
    {},
    {
      get: (target, prop) => {
        if (prop === '__esModule') return true;
        return (props) => React.createElement(View, { ...props, testID: `mock-icon-${String(prop)}` });
      },
    }
  );
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

// Mock WebSocket global for Supabase Realtime
global.WebSocket = class {
  addEventListener = jest.fn();
  removeEventListener = jest.fn();
  send = jest.fn();
  close = jest.fn();
};

// Mock React Native Reanimated
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// Mock React Native Worklets
jest.mock('react-native-worklets', () => ({
  Worklets: {
    createRunInJSFn: (fn) => fn,
    createRunOnJS: (fn) => fn,
  },
  createSerializable: (x) => x,
  isWorkletFunction: () => false,
  RuntimeKind: { ReactNative: 'ReactNative' },
  scheduleOnUI: (fn) => fn,
  serializableMappingCache: new Map(),
}));
jest.mock('react-native-worklets-core', () => ({
  Worklets: {
    createRunInJSFn: (fn) => fn,
  },
  createSerializable: (x) => x,
  isWorkletFunction: () => false,
  RuntimeKind: { ReactNative: 'ReactNative' },
  scheduleOnUI: (fn) => fn,
  serializableMappingCache: new Map(),
}));

// Mock react-native-vision-camera
jest.mock('react-native-vision-camera', () => ({
  Camera: () => null,
  useFrameProcessor: jest.fn(),
}));

// Mock react-native-vision-camera-ocr-plus
jest.mock('react-native-vision-camera-ocr-plus', () => ({
  useTextRecognition: jest.fn(),
}));

// Mock @react-native-community/netinfo globally
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn().mockResolvedValue({
    isConnected: true,
    isInternetReachable: true,
  }),
  addEventListener: jest.fn(() => jest.fn()),
}));

// Configure React Query notifyManager for testing: execute updates synchronously to avoid act() warnings
const { notifyManager } = require('@tanstack/react-query');
notifyManager.setScheduler((fn) => fn());

// Mock Supabase globally to prevent realtime connections from hanging in tests
jest.mock('@/src/shared/api/supabase', () => {
  const mockChannel = {
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockReturnThis(),
  };
  return {
    supabase: {
      channel: jest.fn().mockReturnValue(mockChannel),
      removeChannel: jest.fn(),
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      }),
      auth: {
        signInWithPassword: jest.fn(),
        signUp: jest.fn(),
        signOut: jest.fn(),
        resetPasswordForEmail: jest.fn(),
        getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
        getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
        onAuthStateChange: jest.fn().mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }),
        signInWithIdToken: jest.fn(),
        signInWithOAuth: jest.fn(),
        setSession: jest.fn(),
      },
      functions: {
        invoke: jest.fn(),
      },
    },
  };
});

// Mock expo-router globally for unit tests
jest.mock('expo-router', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    useRouter: jest.fn(() => ({
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
      navigate: jest.fn(),
      setParams: jest.fn(),
      dismiss: jest.fn(),
      dismissAll: jest.fn(),
      canGoBack: jest.fn(() => true),
    })),
    usePathname: jest.fn(() => '/'),
    useLocalSearchParams: jest.fn(() => ({})),
    useGlobalSearchParams: jest.fn(() => ({})),
    useSegments: jest.fn(() => []),
    useFocusEffect: jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    }),
    Link: (props) => React.createElement(View, props, props.children),
    Redirect: () => null,
    Slot: (props) => React.createElement(View, props, props.children),
    Stack: Object.assign(
      (props) => React.createElement(View, props, props.children),
      { Screen: () => null }
    ),
    Tabs: Object.assign(
      (props) => React.createElement(View, props, props.children),
      { Screen: () => null }
    ),
  };
});

