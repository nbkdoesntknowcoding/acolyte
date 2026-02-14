import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Acolyte Admin",
  slug: "acolyte-admin",
  version: "1.0.0",
  orientation: "portrait",
  scheme: "acolyte-admin",
  userInterfaceStyle: "dark",
  newArchEnabled: true,
  icon: "./assets/icon.png",
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#0A0A0F",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.acolyte.admin",
    infoPlist: {
      NSFaceIDUsageDescription:
        "Verify identity for sensitive admin actions",
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#0A0A0F",
    },
    package: "com.acolyte.admin",
  },
  plugins: ["expo-router", "expo-secure-store", "expo-web-browser"],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    clerkPublishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
    apiUrl:
      process.env.EXPO_PUBLIC_API_URL || "https://acolyte-api.fly.dev",
  },
});
