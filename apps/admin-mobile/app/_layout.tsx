import { useEffect, useRef, useState, useCallback } from "react";
import { StatusBar } from "expo-status-bar";
import {
  Stack,
  useRouter,
  useSegments,
  useRootNavigationState,
} from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-expo";
import { AuthProvider } from "@/lib/auth/clerk-provider";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import * as SecureStore from "expo-secure-store";
import { colors } from "@/lib/theme";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { tokenManager } from "@/lib/device-trust/token-manager";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
    },
  },
});

/**
 * Auth gate — redirects unauthenticated users to sign-in.
 * Checks device trust registration after Clerk auth.
 * Authenticated users without device trust go to register-device.
 */
function AuthGate() {
  const { isSignedIn, isLoaded } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const rootNavState = useRootNavigationState();
  const [deviceChecked, setDeviceChecked] = useState(false);
  const [deviceRegistered, setDeviceRegistered] = useState(false);

  // Stable string key from segments — useSegments() returns a new array ref
  // on every render, so using it directly as a dependency causes infinite loops.
  const segmentKey = (segments as string[]).join("/");

  // Recheck device registration (called on mount + after register-device stores token)
  const recheckDevice = useCallback(async () => {
    const hasToken = await tokenManager.isRegistered();
    const skipped = await SecureStore.getItemAsync("device_trust_skipped");
    setDeviceRegistered(hasToken || skipped === "true");
    setDeviceChecked(true);
  }, []);

  // Check device registration when signed in, and re-check when route changes
  // (so that after register-device stores a token, we pick it up).
  useEffect(() => {
    if (!isSignedIn) {
      setDeviceChecked(false);
      setDeviceRegistered(false);
      return;
    }
    recheckDevice();
  }, [isSignedIn, segmentKey, recheckDevice]);

  // Navigation guard — only redirect when the navigator is fully mounted
  useEffect(() => {
    if (!isLoaded || !rootNavState?.key) return;

    const segs = segments as string[];
    const inAuthGroup = segs[0] === "(auth)";
    const onRegisterDevice = segs[1] === "register-device";

    if (!isSignedIn && !inAuthGroup) {
      router.replace("/(auth)/sign-in");
    } else if (isSignedIn && deviceChecked) {
      if (!deviceRegistered && !onRegisterDevice) {
        router.replace("/(auth)/register-device");
      } else if (deviceRegistered && inAuthGroup) {
        router.replace("/(tabs)/dashboard");
      }
    }
  }, [isSignedIn, isLoaded, deviceChecked, deviceRegistered, segmentKey, rootNavState?.key]);

  if (!isLoaded || !rootNavState?.key || (isSignedIn && !deviceChecked)) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="modals/notice-compose"
        options={{ presentation: "modal", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="modals/grievance-update"
        options={{ presentation: "modal", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="modals/device-reset"
        options={{ presentation: "modal", animation: "slide_from_bottom" }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <AuthProvider>
          <QueryClientProvider client={queryClient}>
            <StatusBar style="light" />
            <AuthGate />
          </QueryClientProvider>
        </AuthProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
});
