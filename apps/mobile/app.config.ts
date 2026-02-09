import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Acolyte',
  slug: 'acolyte',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'acolyte',
  userInterfaceStyle: 'dark',
  newArchEnabled: true,
  splash: {
    backgroundColor: '#0A0A0A',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.myacolyte.app',
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#0A0A0A',
    },
    package: 'com.myacolyte.app',
  },
  web: {
    bundler: 'metro',
    output: 'static',
  },
  plugins: ['expo-router', 'expo-secure-store'],
  experiments: {
    typedRoutes: true,
  },
});
