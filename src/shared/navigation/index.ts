// Navigation abstraite
export {
  ExpoRouterAdapter, INavigationService,
  NavigateOptions, NavigationProvider, RouteParams, useNavigation
} from './NavigationContext';

export {
  MockNavigationService,
  createMockNavigationService
} from './MockNavigationService';

export { useSmartNavigation } from './useSmartNavigation';
