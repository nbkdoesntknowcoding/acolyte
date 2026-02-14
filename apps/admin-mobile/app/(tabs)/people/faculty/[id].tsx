import { View, Text, ScrollView, Pressable, Linking, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { format } from "date-fns";
import { colors, spacing, fontSize, radius } from "@/lib/theme";
import { useFaculty } from "@/lib/hooks/use-people-search";
import { useDeviceByUser } from "@/lib/hooks/use-devices";
import { useScanLogs } from "@/lib/hooks/use-scan-logs";
import { Badge } from "@/components/ui/Badge";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";

export default function FacultyProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: faculty, isLoading } = useFaculty(id ?? "");
  const { data: device } = useDeviceByUser(id ?? "");
  const { data: recentScans } = useScanLogs({ user_id: id, page_size: 5 });

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.loadingWrap}>
          <SkeletonLoader height={80} />
          <SkeletonLoader height={120} />
          <SkeletonLoader height={80} />
        </View>
      </SafeAreaView>
    );
  }

  if (!faculty) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>Faculty not found.</Text>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const initials = faculty.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Back */}
        <Pressable onPress={() => router.back()} style={styles.backRow}>
          <Feather name="chevron-left" size={20} color={colors.primary} />
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>

        {/* Header card */}
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View
              style={[
                styles.avatar,
                { backgroundColor: colors.primary + "20" },
              ]}
            >
              <Text style={[styles.avatarText, { color: colors.primary }]}>
                {initials}
              </Text>
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.name}>{faculty.name}</Text>
              <Text style={styles.designation}>
                {faculty.designation ?? "Faculty"}
              </Text>
              <Badge
                label={faculty.status}
                variant={faculty.status === "active" ? "success" : "outline"}
                size="md"
              />
            </View>
          </View>

          {/* Quick actions */}
          <View style={styles.quickActions}>
            {faculty.phone && (
              <Pressable
                onPress={() => Linking.openURL(`tel:${faculty.phone}`)}
                style={({ pressed }) => [
                  styles.quickBtn,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Feather name="phone" size={18} color={colors.textMuted} />
                <Text style={styles.quickLabel}>Call</Text>
              </Pressable>
            )}
            {faculty.email && (
              <Pressable
                onPress={() => Linking.openURL(`mailto:${faculty.email}`)}
                style={({ pressed }) => [
                  styles.quickBtn,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Feather name="mail" size={18} color={colors.textMuted} />
                <Text style={styles.quickLabel}>Email</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/campus/device-detail",
                  params: { userId: id! },
                })
              }
              style={({ pressed }) => [
                styles.quickBtn,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Feather name="smartphone" size={18} color={colors.textMuted} />
              <Text style={styles.quickLabel}>Device</Text>
            </Pressable>
          </View>
        </View>

        {/* Details */}
        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Details</Text>
          <InfoRow
            label="Department"
            value={faculty.department_name ?? "—"}
          />
          <InfoRow
            label="Qualification"
            value={faculty.qualification ?? "—"}
          />
          <InfoRow
            label="Employment"
            value={faculty.employment_type ?? "—"}
          />
          {faculty.date_of_joining && (
            <InfoRow
              label="Date of Joining"
              value={format(new Date(faculty.date_of_joining), "d MMM yyyy")}
            />
          )}
          {faculty.teaching_experience_years != null && (
            <InfoRow
              label="Experience"
              value={`${faculty.teaching_experience_years} years`}
            />
          )}
          {faculty.specialization && (
            <InfoRow label="Specialization" value={faculty.specialization} />
          )}
          {faculty.nmc_faculty_id && (
            <InfoRow label="NMC Faculty ID" value={faculty.nmc_faculty_id} />
          )}
          <InfoRow label="Email" value={faculty.email ?? "—"} />
          {faculty.phone && <InfoRow label="Phone" value={faculty.phone} />}
        </View>

        {/* Device Status */}
        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Device Status</Text>
          {device ? (
            <>
              <InfoRow label="Model" value={device.device_model} />
              <InfoRow
                label="Platform"
                value={`${device.platform} ${device.os_version}`}
              />
              <InfoRow
                label="Last Active"
                value={
                  device.last_active_at
                    ? format(new Date(device.last_active_at), "d MMM, h:mm a")
                    : "—"
                }
              />
              <InfoRow label="Status" value={device.status} />
            </>
          ) : (
            <Text style={styles.mutedText}>No device registered</Text>
          )}
        </View>

        {/* Recent Scans */}
        {recentScans && recentScans.length > 0 && (
          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>
              Recent Scans ({recentScans.length})
            </Text>
            {recentScans.map((scan) => (
              <View key={scan.id} style={styles.scanRow}>
                <View
                  style={[
                    styles.scanDot,
                    {
                      backgroundColor:
                        scan.validation_result === "valid"
                          ? colors.success
                          : scan.validation_result === "duplicate"
                            ? colors.warning
                            : colors.error,
                    },
                  ]}
                />
                <View style={styles.scanInfo}>
                  <Text style={styles.scanAction}>
                    {scan.action_point_name ?? scan.action_type}
                  </Text>
                  <Text style={styles.scanTime}>
                    {format(new Date(scan.scanned_at), "d MMM, h:mm a")}
                  </Text>
                </View>
                <Feather
                  name={
                    scan.validation_result === "valid"
                      ? "check-circle"
                      : scan.validation_result === "duplicate"
                        ? "alert-triangle"
                        : "x-circle"
                  }
                  size={14}
                  color={
                    scan.validation_result === "valid"
                      ? colors.success
                      : scan.validation_result === "duplicate"
                        ? colors.warning
                        : colors.error
                  }
                />
              </View>
            ))}
          </View>
        )}

        {/* Edit on Web */}
        <View style={styles.webLinkWrap}>
          <Text style={styles.webLinkText}>
            Full editing available on the web dashboard
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

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
  backLabel: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: "600",
  },

  // Header card
  headerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: fontSize.lg,
    fontWeight: "700",
  },
  headerInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  name: {
    fontSize: fontSize.lg,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  designation: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },

  // Quick actions
  quickActions: {
    flexDirection: "row",
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  quickBtn: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
  },
  quickLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontWeight: "600",
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
    flexShrink: 1,
    textAlign: "right",
  },
  mutedText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontStyle: "italic",
  },

  // Scan timeline
  scanRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  scanDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  scanInfo: {
    flex: 1,
    gap: 1,
  },
  scanAction: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    fontWeight: "500",
  },
  scanTime: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  // Web link
  webLinkWrap: {
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  webLinkText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontStyle: "italic",
  },
});
