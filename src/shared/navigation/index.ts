// Navigation abstraite
export {
  INavigationService,
  NavigateOptions,
  RouteParams,
  NavigationProvider,
  useNavigation,
  ExpoRouterAdapter,
} from './NavigationContext';

export {
  MockNavigationService,
  createMockNavigationService,
} from './MockNavigationService';

export { useSmartNavigation } from './useSmartNavigation';
