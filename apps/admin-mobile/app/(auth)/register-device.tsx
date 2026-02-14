import { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { colors, radius, spacing, fontSize } from "@/lib/theme";
import { createAuthClient } from "@/lib/api/client";
import { deviceRegistrationApi } from "@/lib/api/device-api";
import {
  collectDeviceInfo,
  type DeviceInfoPayload,
} from "@/lib/device-trust/fingerprint";
import { tokenManager } from "@/lib/device-trust/token-manager";

type Step = "phone" | "collecting" | "verifying" | "success";

export default function RegisterDeviceScreen() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const apiRef = useRef(createAuthClient(getToken));

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfoPayload | null>(null);
  const [verificationId, setVerificationId] = useState("");
  const [devMode, setDevMode] = useState(false);
  const [pollCount, setPollCount] = useState(0);

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pre-fill phone from Clerk profile if available
  useEffect(() => {
    if (user?.primaryPhoneNumber?.phoneNumber) {
      setPhone(user.primaryPhoneNumber.phoneNumber);
    }
  }, [user]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  // ── Step 1→2: Collect device info + call register ──
  const handleContinue = useCallback(async () => {
    const trimmed = phone.trim();
    if (!trimmed || trimmed.length < 10) {
      setError("Enter a valid 10-digit phone number");
      return;
    }
    setError("");
    setStep("collecting");

    try {
      const info = await collectDeviceInfo();
      setDeviceInfo(info);

      const result = await deviceRegistrationApi.register(
        apiRef.current,
        trimmed,
        info,
      );

      setVerificationId(result.verification_id);
      setDevMode(result.dev_mode);
      setStep("verifying");

      // Start polling
      startPolling(result.verification_id);
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ??
        err?.message ??
        "Registration failed. Try again.";
      setError(msg);
      setStep("phone");
    }
  }, [phone]);

  // ── Polling for verification status ──
  const startPolling = useCallback(
    (vId: string) => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      setPollCount(0);

      pollTimerRef.current = setInterval(async () => {
        setPollCount((c) => {
          if (c >= 30) {
            // 60 seconds timeout (30 polls * 2s)
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            setError("Verification timed out. Please try again.");
            setStep("phone");
            return 0;
          }
          return c + 1;
        });

        try {
          const status = await deviceRegistrationApi.checkStatus(
            apiRef.current,
            vId,
          );

          if (status.status === "active" && status.device_trust_token) {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            await tokenManager.store(
              status.device_trust_token,
              status.token_expires_at ?? "",
            );
            setStep("success");
          } else if (status.status === "failed") {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            setError(status.message ?? "Verification failed");
            setStep("phone");
          }
        } catch {
          // Ignore transient polling errors
        }
      }, 2000);
    },
    [],
  );

  // ── Navigate to app ──
  const handleFinish = useCallback(() => {
    router.replace("/(tabs)/dashboard");
  }, [router]);

  // ── Skip device trust ──
  const handleSkip = useCallback(async () => {
    await SecureStore.setItemAsync("device_trust_skipped", "true");
    router.replace("/(tabs)/dashboard");
  }, [router]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Step 1: Phone Input ── */}
        {step === "phone" && (
          <View style={styles.stepContainer}>
            <View style={styles.iconCircle}>
              <Feather name="shield" size={32} color={colors.accent} />
            </View>
            <Text style={styles.heading}>Secure This Device</Text>
            <Text style={styles.description}>
              Register this device as your secure admin terminal. One-time
              setup.
            </Text>

            <View style={styles.form}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                placeholder="+91 98765 43210"
                placeholderTextColor={colors.textPlaceholder}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoComplete="tel"
                maxLength={15}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Pressable
                onPress={handleContinue}
                style={({ pressed }) => [
                  styles.button,
                  pressed && { opacity: 0.8 },
                  !phone.trim() && { opacity: 0.5 },
                ]}
                disabled={!phone.trim()}
              >
                <Text style={styles.buttonText}>Continue</Text>
              </Pressable>
            </View>

            <Pressable onPress={handleSkip} style={styles.skipBtn}>
              <Text style={styles.skipText}>Skip for now</Text>
            </Pressable>
          </View>
        )}

        {/* ── Step 2: Collecting Device Info ── */}
        {step === "collecting" && (
          <View style={styles.stepContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[styles.heading, { marginTop: spacing.xl }]}>
              Reading Device
            </Text>
            <Text style={styles.description}>
              Collecting device information...
            </Text>
          </View>
        )}

        {/* ── Step 3: Verifying ── */}
        {step === "verifying" && (
          <View style={styles.stepContainer}>
            {devMode ? (
              <>
                <View style={styles.iconCircle}>
                  <Feather
                    name="check-circle"
                    size={32}
                    color={colors.accent}
                  />
                </View>
                <Text style={styles.heading}>Auto-Verifying</Text>
                <Text style={styles.description}>
                  Dev mode active. Simulating SMS verification...
                </Text>
                <ActivityIndicator
                  size="small"
                  color={colors.accent}
                  style={{ marginTop: spacing.lg }}
                />
              </>
            ) : (
              <>
                <View style={styles.iconCircle}>
                  <Feather
                    name="message-square"
                    size={32}
                    color={colors.accent}
                  />
                </View>
                <Text style={styles.heading}>SMS Verification</Text>
                <Text style={styles.description}>
                  Send an SMS from your phone to verify ownership. The app is
                  waiting for verification...
                </Text>
                <ActivityIndicator
                  size="small"
                  color={colors.accent}
                  style={{ marginTop: spacing.lg }}
                />
                <Text style={styles.pollHint}>
                  Checking... ({pollCount * 2}s)
                </Text>
              </>
            )}

            {deviceInfo && (
              <View style={styles.deviceInfoBox}>
                <Text style={styles.deviceInfoTitle}>Device Info</Text>
                <Text style={styles.deviceInfoRow}>
                  {deviceInfo.device_manufacturer} {deviceInfo.device_model}
                </Text>
                <Text style={styles.deviceInfoRow}>
                  {deviceInfo.platform === "android" ? "Android" : "iOS"}{" "}
                  {deviceInfo.os_version}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── Step 4: Success ── */}
        {step === "success" && (
          <View style={styles.stepContainer}>
            <View style={[styles.iconCircle, styles.iconCircleSuccess]}>
              <Feather name="check-circle" size={40} color={colors.accent} />
            </View>
            <Text style={styles.heading}>Device Secured</Text>
            <Text style={styles.description}>
              Your admin terminal is now registered. Token valid for 180 days.
            </Text>

            <Pressable
              onPress={handleFinish}
              style={({ pressed }) => [
                styles.button,
                { marginTop: spacing.xxl },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={styles.buttonText}>Continue to App</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing["4xl"],
  },
  stepContainer: {
    alignItems: "center",
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accentBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
  },
  iconCircleSuccess: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  heading: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: spacing.lg,
  },
  form: {
    width: "100%",
    marginTop: spacing.xxl,
    gap: spacing.md,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    height: 48,
    fontSize: fontSize.base,
    color: colors.text,
  },
  error: {
    fontSize: fontSize.sm,
    color: colors.error,
    textAlign: "center",
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  buttonText: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.background,
  },
  skipBtn: {
    marginTop: spacing.xxl,
    paddingVertical: spacing.sm,
  },
  skipText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: "center",
  },
  pollHint: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  deviceInfoBox: {
    marginTop: spacing.xl,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    width: "100%",
  },
  deviceInfoTitle: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  deviceInfoRow: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
});
