import { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as LocalAuthentication from "expo-local-authentication";
import * as Haptics from "expo-haptics";
import { format } from "date-fns";
import { colors, spacing, fontSize, radius } from "@/lib/theme";
import { useDeviceByUser, useResetDevice } from "@/lib/hooks/use-devices";
import { Badge } from "@/components/ui/Badge";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";

const RESET_REASONS = [
  { key: "phone_lost", label: "Phone Lost" },
  { key: "phone_stolen", label: "Phone Stolen" },
  { key: "phone_upgraded", label: "Phone Upgraded" },
  { key: "security_concern", label: "Security Concern" },
  { key: "other", label: "Other" },
] as const;

export default function DeviceResetModal() {
  const { userId, userName } = useLocalSearchParams<{
    userId: string;
    userName?: string;
  }>();
  const router = useRouter();

  const { data: device, isLoading } = useDeviceByUser(userId ?? "");
  const resetMutation = useResetDevice();

  const [reason, setReason] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState("");

  const handleReset = useCallback(async () => {
    if (!reason || !userId) return;

    // Biometric confirmation
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (hasHardware) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Confirm device reset",
        disableDeviceFallback: false,
      });
      if (!result.success) {
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        return;
      }
    }

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }

    const fullReason = adminNotes.trim()
      ? `${reason}: ${adminNotes.trim()}`
      : reason;

    resetMutation.mutate(
      { userId, reason: fullReason },
      {
        onSuccess: () => {
          if (Platform.OS !== "web") {
            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success,
            );
          }
          Alert.alert("Success", "Device has been reset.", [
            { text: "OK", onPress: () => router.back() },
          ]);
        },
        onError: () => {
          Alert.alert("Error", "Failed to reset device. Please try again.");
        },
      },
    );
  }, [reason, userId, adminNotes, resetMutation, router]);

  const statusVariant =
    device?.status === "active"
      ? ("success" as const)
      : device?.status === "revoked"
        ? ("error" as const)
        : ("outline" as const);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Reset Device</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {isLoading ? (
            <View style={styles.skeletonWrap}>
              <SkeletonLoader height={120} />
              <SkeletonLoader height={80} />
            </View>
          ) : device ? (
            <>
              {/* User + Device Info */}
              <View style={styles.infoCard}>
                <View style={styles.infoHeader}>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>
                      {userName ?? device.user_name ?? device.user_id.slice(0, 16)}
                    </Text>
                    <Text style={styles.userType}>
                      {device.user_type ?? "User"}
                    </Text>
                  </View>
                  <Badge
                    label={device.status}
                    variant={statusVariant}
                    size="md"
                  />
                </View>

                <View style={styles.divider} />

                <InfoRow label="Model" value={device.device_model} />
                <InfoRow
                  label="Platform"
                  value={`${device.platform} ${device.os_version}`}
                />
                <InfoRow label="App Version" value={device.app_version} />
                <InfoRow
                  label="Registered"
                  value={format(
                    new Date(device.registered_at),
                    "d MMM yyyy",
                  )}
                />
                <InfoRow
                  label="Total Scans"
                  value={String(device.total_qr_scans)}
                />
              </View>

              {/* Reason */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Reason for Reset</Text>
                <View style={styles.reasonGrid}>
                  {RESET_REASONS.map((r) => {
                    const active = reason === r.key;
                    return (
                      <Pressable
                        key={r.key}
                        onPress={() => setReason(r.key)}
                        style={[
                          styles.reasonChip,
                          active && styles.reasonChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.reasonText,
                            active && styles.reasonTextActive,
                          ]}
                        >
                          {r.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Admin Notes */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Admin Notes (optional)</Text>
                <TextInput
                  style={[styles.input, styles.textarea]}
                  value={adminNotes}
                  onChangeText={setAdminNotes}
                  placeholder="Additional notes..."
                  placeholderTextColor={colors.textPlaceholder}
                  multiline
                  textAlignVertical="top"
                />
              </View>

              {/* Warning */}
              <View style={styles.warningBanner}>
                <Text style={styles.warningText}>
                  This will unlink the device. The user must re-register their
                  device to continue using the app. Biometric confirmation
                  required.
                </Text>
              </View>

              {/* Reset Button */}
              <Pressable
                onPress={handleReset}
                disabled={!reason || resetMutation.isPending}
                style={({ pressed }) => [
                  styles.resetBtn,
                  pressed && { opacity: 0.8 },
                  (!reason || resetMutation.isPending) && { opacity: 0.4 },
                ]}
              >
                {resetMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.resetBtnText}>Reset Device</Text>
                )}
              </Pressable>
            </>
          ) : (
            <View style={styles.emptyWrap}>
              <Text style={styles.errorText}>
                No device found for this user.
              </Text>
              <Pressable
                onPress={() => router.back()}
                style={styles.backBtn}
              >
                <Text style={styles.backBtnText}>Go Back</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cancelText: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  headerTitle: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.xl,
    paddingBottom: spacing["4xl"],
  },
  skeletonWrap: {
    gap: spacing.lg,
  },

  // Info card
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  infoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  userInfo: {
    gap: 2,
  },
  userName: {
    fontSize: fontSize.lg,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  userType: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textTransform: "capitalize",
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  infoLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  infoValue: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    fontWeight: "500",
  },

  // Fields
  field: {
    gap: spacing.sm,
  },
  fieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },
  textarea: {
    minHeight: 80,
    paddingTop: spacing.md,
  },

  // Reason chips
  reasonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  reasonChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  reasonChipActive: {
    borderColor: colors.error,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
  },
  reasonText: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: colors.textSecondary,
  },
  reasonTextActive: {
    color: colors.error,
    fontWeight: "700",
  },

  // Warning
  warningBanner: {
    backgroundColor: "rgba(245, 158, 11, 0.06)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.20)",
    padding: spacing.md,
  },
  warningText: {
    fontSize: fontSize.xs,
    color: colors.warning,
    lineHeight: 18,
  },

  // Reset button
  resetBtn: {
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.error,
    alignItems: "center",
    justifyContent: "center",
  },
  resetBtnText: {
    fontSize: fontSize.base,
    fontWeight: "700",
    color: "#fff",
  },

  // Empty / error
  emptyWrap: {
    alignItems: "center",
    gap: spacing.lg,
    paddingVertical: spacing["4xl"],
  },
  errorText: {
    fontSize: fontSize.base,
    color: colors.error,
  },
  backBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backBtnText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: "600",
  },
});
