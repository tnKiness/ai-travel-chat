import type { ConfigContext, ExpoConfig } from 'expo/config';

// Static settings live in app.json; this only adds what depends on the build environment.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  experiments: {
    ...config.experiments,
    // GitHub Pages serves the demo from /<repo>/, so assets must be prefixed.
    ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {}),
  },
});
