export const PUBLIC_ROUTES = ['/', '/about', '/contact', '/terms', '/privacy'];
export const AUTH_ROUTES_PREFIX = '/u';
export const AUTH_PAGES = ['/u/signin', '/u/signup', '/u/forgot', '/u/verify', '/u/auth'];
export const ONBOARDING_ROUTE = '/u/onboard';
export const ERROR_ROUTE = '/u/error';
export const API_AUTH_CONFIRM_ROUTE = '/api/auth/confirm';
export const ADMIN_ROUTES_PREFIXES = ['/admin'];

export const PROTECTED_ROUTES_PREFIXES = ['/dashboard', '/profile'];

export const FEATURE_ROUTES = {
  EVENTS: ['/events', '/event/'],
  SUCCESS_STORIES: ['/success', '/story/'],
  NETWORKING_HUB: ['/hub', '/groups', '/group/'],
  ALUMNI_DIRECTORY: ['/directory'],
};

export const isFeatureDisabled = (featureKey: keyof typeof FEATURE_ROUTES): boolean => {
  const envVarMap: Record<keyof typeof FEATURE_ROUTES, string | undefined> = {
    EVENTS: process.env.FF_EVENTS_DISABLED,
    SUCCESS_STORIES: process.env.FF_SUCCESS_STORIES_DISABLED,
    NETWORKING_HUB: process.env.FF_NETWORKING_HUB_DISABLED,
    ALUMNI_DIRECTORY: process.env.FF_ALUMNI_DIRECTORY_DISABLED,
  };
  return envVarMap[featureKey] === 'true';
};

export const isPathForDisabledFeature = (pathname: string): boolean => {
  for (const key in FEATURE_ROUTES) {
    const featureKey = key as keyof typeof FEATURE_ROUTES;
    if (isFeatureDisabled(featureKey)) {
      const paths = FEATURE_ROUTES[featureKey];
      if (paths.some(p => pathname === p || (p.endsWith('/') && pathname.startsWith(p)))) {
        return true; // Path matches a disabled feature
      }
    }
  }
  return false;
};

export const isFullMaintenanceMode = (): boolean => process.env.FF_FULL_MAINTENANCE_MODE === 'true';
export const isPartialMaintenanceMode = (): boolean => process.env.FF_MAINTENANCE_MODE === 'true';