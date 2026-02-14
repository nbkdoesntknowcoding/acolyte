import { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Linking,
  Alert,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as LocalAuthentication from "expo-local-authentication";
import * as Haptics from "expo-haptics";
import { format, formatDistanceToNow } from "date-fns";
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
];

export default function DeviceDetailScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetReason, setResetReason] = useState<string | null>(null);

  const { data: device, isLoading, isError } = useDeviceByUser(userId ?? "");
  const resetMutation = useResetDevice();

  const handleReset = useCallback(async () => {
    if (!resetReason || !userId) return;

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

    resetMutation.mutate(
      { userId, reason: resetReason },
      {
        onSuccess: () => {
          Alert.alert("Success", "Device has been reset.", [
            { text: "OK", onPress: () => router.back() },
          ]);
        },
        onError: () => {
          Alert.alert("Error", "Failed to reset device. Please try again.");
        },
      },
    );
  }, [resetReason, userId, resetMutation, router]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.loadingWrap}>
          <SkeletonLoader height={150} />
          <SkeletonLoader height={100} />
          <SkeletonLoader height={60} />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !device) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>Device not found.</Text>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const statusVariant =
    device.status === "active"
      ? ("success" as const)
      : device.status === "revoked"
        ? ("error" as const)
        : ("outline" as const);

  const maskedPhone = device.phone
    ? `+91 ****${device.phone.slice(-4)}`
    : null;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Back */}
        <Pressable onPress={() => router.back()} style={styles.backRow}>
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>

        {/* User + Status */}
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(device.user_name ?? device.user_id).charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {device.user_name ?? device.user_id.slice(0, 16)}
            </Text>
            <Text style={styles.profileType}>
              {device.user_type ?? "User"}
            </Text>
          </View>
          <Badge label={device.status} variant={statusVariant} size="md" />
        </View>

        {/* Device Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Device</Text>
          <InfoRow label="Model" value={device.device_model} />
          <InfoRow
            label="Platform"
            value={`${device.platform} ${device.os_version}`}
          />
          <InfoRow label="App Version" value={device.app_version} />
          <InfoRow
            label="Registered"
            value={format(new Date(device.registered_at), "d MMM yyyy")}
          />
          <InfoRow
            label="Last Active"
            value={formatDistanceToNow(new Date(device.last_active_at), {
              addSuffix: true,
            })}
          />
          <InfoRow
            label="Total Scans"
            value={String(device.total_qr_scans)}
          />
          {maskedPhone && <InfoRow label="Phone" value={maskedPhone} />}
        </View>

        {/* Revoke info */}
        {device.revoked_at && (
          <View style={[styles.infoCard, styles.revokedCard]}>
            <Text style={styles.cardTitle}>Revocation</Text>
            <InfoRow
              label="Revoked"
              value={format(new Date(device.revoked_at), "d MMM yyyy, h:mm a")}
            />
            {device.revoke_reason && (
              <InfoRow label="Reason" value={device.revoke_reason} />
            )}
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsSection}>
          {/* Reset Device */}
          {device.status === "active" && !showResetForm && (
            <Pressable
              onPress={() => setShowResetForm(true)}
              style={({ pressed }) => [
                styles.actionRow,
                styles.dangerRow,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.actionEmoji}>🔄</Text>
              <View style={styles.actionTextWrap}>
                <Text style={styles.actionTitle}>Reset Device</Text>
                <Text style={styles.actionDesc}>
                  Unlink this device. User must re-register.
                </Text>
              </View>
            </Pressable>
          )}

          {/* Reset form */}
          {showResetForm && (
            <View style={styles.resetForm}>
              <Text style={styles.resetTitle}>Reset Device</Text>
              <Text style={styles.resetSubtitle}>
                Select a reason (biometric required)
              </Text>
              {RESET_REASONS.map((r) => (
                <Pressable
                  key={r.key}
                  onPress={() => setResetReason(r.key)}
                  style={[
                    styles.reasonChip,
                    resetReason === r.key && styles.reasonChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.reasonText,
                      resetReason === r.key && styles.reasonTextActive,
                    ]}
                  >
                    {r.label}
                  </Text>
                </Pressable>
              ))}
              <View style={styles.resetActions}>
                <Pressable
                  onPress={() => {
                    setShowResetForm(false);
                    setResetReason(null);
                  }}
                  style={({ pressed }) => [
                    styles.resetCancelBtn,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={styles.resetCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleReset}
                  disabled={!resetReason || resetMutation.isPending}
                  style={({ pressed }) => [
                    styles.resetConfirmBtn,
                    pressed && { opacity: 0.7 },
                    (!resetReason || resetMutation.isPending) && {
                      opacity: 0.4,
                    },
                  ]}
                >
                  {resetMutation.isPending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.resetConfirmText}>
                      Confirm Reset
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          )}

          {/* View Scan History */}
          <Pressable
            onPress={() => {
              // Navigate to campus live feed filtered by user
              router.back();
            }}
            style={({ pressed }) => [
              styles.actionRow,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.actionEmoji}>📊</Text>
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionTitle}>View Scan History</Text>
              <Text style={styles.actionDesc}>
                See all {device.total_qr_scans} scans from this device
              </Text>
            </View>
          </Pressable>

          {/* Call User */}
          {device.phone && (
            <Pressable
              onPress={() => Linking.openURL(`tel:${device.phone}`)}
              style={({ pressed }) => [
                styles.actionRow,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.actionEmoji}>📞</Text>
              <View style={styles.actionTextWrap}>
                <Text style={styles.actionTitle}>Call User</Text>
                <Text style={styles.actionDesc}>{maskedPhone}</Text>
              </View>
            </Pressable>
          )}

          {/* View Profile */}
          <Pressable
            onPress={() => {
              const path =
                device.user_type === "faculty"
                  ? "/(tabs)/people/faculty/[id]"
                  : "/(tabs)/people/student/[id]";
              router.push({
                pathname: path as any,
                params: { id: device.user_id },
              });
            }}
            style={({ pressed }) => [
              styles.actionRow,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.actionEmoji}>👤</Text>
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionTitle}>View Profile</Text>
              <Text style={styles.actionDesc}>
                Open in People tab
              </Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>
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
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing["4xl"],
  },
  loadingWrap: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  errorWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
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

  // Back row
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  backArrow: {
    fontSize: fontSize["2xl"],
    color: colors.primary,
    fontWeight: "300",
  },
  backLabel: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: "600",
  },

  // Profile
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryDim,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.primary,
  },
  profileInfo: {
    flex: 1,
    gap: 2,
  },
  profileName: {
    fontSize: fontSize.lg,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  profileType: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textTransform: "capitalize",
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
  revokedCard: {
    borderColor: "rgba(239, 68, 68, 0.25)",
  },
  cardTitle: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
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

  // Actions
  actionsSection: {
    gap: spacing.sm,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  dangerRow: {
    borderColor: "rgba(239, 68, 68, 0.25)",
  },
  actionEmoji: {
    fontSize: 20,
  },
  actionTextWrap: {
    flex: 1,
    gap: 2,
  },
  actionTitle: {
    fontSize: fontSize.base,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  actionDesc: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  // Reset form
  resetForm: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
    padding: spacing.lg,
    gap: spacing.md,
  },
  resetTitle: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  resetSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  reasonChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reasonChipActive: {
    borderColor: colors.error,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
  },
  reasonText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  reasonTextActive: {
    color: colors.error,
    fontWeight: "700",
  },
  resetActions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  resetCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  resetCancelText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  resetConfirmBtn: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.error,
    alignItems: "center",
    justifyContent: "center",
  },
  resetConfirmText: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: "#fff",
  },
});
