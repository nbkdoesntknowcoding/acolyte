import { View, Text, ScrollView, Pressable, Linking, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { format } from "date-fns";
import { colors, spacing, fontSize, radius } from "@/lib/theme";
import {
  useStudent,
  useStudentFees,
  useStudentAttendance,
} from "@/lib/hooks/use-people-search";
import { useDeviceByUser } from "@/lib/hooks/use-devices";
import { useScanLogs } from "@/lib/hooks/use-scan-logs";
import { Badge } from "@/components/ui/Badge";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";

export default function StudentProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: student, isLoading } = useStudent(id ?? "");
  const { data: fees } = useStudentFees(id ?? "");
  const { data: attendance } = useStudentAttendance(id ?? "");
  const { data: device } = useDeviceByUser(id ?? "");
  const { data: recentScans } = useScanLogs({ user_id: id, page_size: 5 });

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.loadingWrap}>
          <SkeletonLoader height={80} />
          <SkeletonLoader height={120} />
          <SkeletonLoader height={80} />
          <SkeletonLoader height={80} />
        </View>
      </SafeAreaView>
    );
  }

  if (!student) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>Student not found.</Text>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const initials = student.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const feeProgress =
    fees && fees.total_fee > 0
      ? Math.round((fees.paid / fees.total_fee) * 100)
      : 0;

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
                { backgroundColor: colors.info + "20" },
              ]}
            >
              <Text style={[styles.avatarText, { color: colors.info }]}>
                {initials}
              </Text>
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.name}>{student.name}</Text>
              <Text style={styles.enrollment}>
                {student.enrollment_number}
              </Text>
              <Badge
                label={student.status}
                variant={student.status === "active" ? "success" : "outline"}
                size="md"
              />
            </View>
          </View>

          <View style={styles.headerMeta}>
            <MetaChip label="Phase" value={student.current_phase ?? "—"} />
            {student.semester != null && (
              <MetaChip label="Sem" value={String(student.semester)} />
            )}
            {student.batch && (
              <MetaChip label="Batch" value={student.batch} />
            )}
            {student.quota && (
              <MetaChip label="Quota" value={student.quota} />
            )}
          </View>

          {/* Quick actions */}
          <View style={styles.quickActions}>
            {student.phone && (
              <Pressable
                onPress={() => Linking.openURL(`tel:${student.phone}`)}
                style={({ pressed }) => [
                  styles.quickBtn,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Feather name="phone" size={18} color={colors.textMuted} />
                <Text style={styles.quickLabel}>Call</Text>
              </Pressable>
            )}
            {student.email && (
              <Pressable
                onPress={() => Linking.openURL(`mailto:${student.email}`)}
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

        {/* Fee Status */}
        {fees && (
          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>Fee Status</Text>
            <View style={styles.feeRow}>
              <View style={styles.feeItem}>
                <Text style={styles.feeLabel}>Total Fee</Text>
                <Text style={styles.feeValue}>
                  {formatCurrency(fees.total_fee)}
                </Text>
              </View>
              <View style={styles.feeItem}>
                <Text style={styles.feeLabel}>Paid</Text>
                <Text style={[styles.feeValue, { color: colors.success }]}>
                  {formatCurrency(fees.paid)}
                </Text>
              </View>
              <View style={styles.feeItem}>
                <Text style={styles.feeLabel}>Outstanding</Text>
                <Text
                  style={[
                    styles.feeValue,
                    { color: fees.overdue ? colors.error : colors.warning },
                  ]}
                >
                  {formatCurrency(fees.outstanding)}
                </Text>
              </View>
            </View>
            {/* Progress bar */}
            <View style={styles.feeProgressTrack}>
              <View
                style={[
                  styles.feeProgressFill,
                  {
                    width: `${feeProgress}%`,
                    backgroundColor:
                      feeProgress >= 90
                        ? colors.success
                        : feeProgress >= 50
                          ? colors.warning
                          : colors.error,
                  },
                ]}
              />
            </View>
            {fees.overdue && (
              <Text style={styles.feeOverdue}>Payment overdue</Text>
            )}
          </View>
        )}

        {/* Attendance */}
        {attendance && (
          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>Attendance</Text>
            <View style={styles.attendanceRow}>
              <AttendanceGauge
                label="Theory"
                percentage={attendance.theory_percentage}
                threshold={attendance.nmc_threshold}
              />
              <AttendanceGauge
                label="Practical"
                percentage={attendance.practical_percentage}
                threshold={attendance.nmc_threshold}
              />
            </View>
            <Text style={styles.attendanceNote}>
              NMC threshold: {attendance.nmc_threshold}% ·{" "}
              {attendance.attended_classes}/{attendance.total_classes} classes
            </Text>
          </View>
        )}

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

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaChip}>
      <Text style={styles.metaChipLabel}>{label}</Text>
      <Text style={styles.metaChipValue}>{value}</Text>
    </View>
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

function AttendanceGauge({
  label,
  percentage,
  threshold,
}: {
  label: string;
  percentage: number;
  threshold: number;
}) {
  const isBelow = percentage < threshold;
  const color = isBelow ? colors.error : colors.success;
  return (
    <View style={styles.gaugeWrap}>
      <Text style={[styles.gaugeValue, { color }]}>
        {percentage.toFixed(1)}%
      </Text>
      <Text style={styles.gaugeLabel}>{label}</Text>
      <View style={styles.gaugeTrack}>
        <View
          style={[
            styles.gaugeFill,
            {
              width: `${Math.min(percentage, 100)}%`,
              backgroundColor: color,
            },
          ]}
        />
        {/* Threshold marker */}
        <View style={[styles.gaugeThreshold, { left: `${threshold}%` }]} />
      </View>
    </View>
  );
}

function formatCurrency(amount: number): string {
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(2)}L`;
  }
  return `₹${amount.toLocaleString("en-IN")}`;
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
  enrollment: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  headerMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  metaChipLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  metaChipValue: {
    fontSize: fontSize.xs,
    color: colors.textPrimary,
    fontWeight: "600",
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
  },
  mutedText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontStyle: "italic",
  },

  // Fee
  feeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  feeItem: {
    alignItems: "center",
    gap: 2,
  },
  feeLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  feeValue: {
    fontSize: fontSize.base,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  feeProgressTrack: {
    width: "100%",
    height: 6,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 3,
    overflow: "hidden",
  },
  feeProgressFill: {
    height: "100%",
    borderRadius: 3,
  },
  feeOverdue: {
    fontSize: fontSize.xs,
    color: colors.error,
    fontWeight: "600",
  },

  // Attendance
  attendanceRow: {
    flexDirection: "row",
    gap: spacing.lg,
  },
  attendanceNote: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  gaugeWrap: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  gaugeValue: {
    fontSize: fontSize.xl,
    fontWeight: "800",
  },
  gaugeLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  gaugeTrack: {
    width: "100%",
    height: 6,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 3,
    overflow: "hidden",
    position: "relative",
  },
  gaugeFill: {
    height: "100%",
    borderRadius: 3,
  },
  gaugeThreshold: {
    position: "absolute",
    top: -1,
    width: 2,
    height: 8,
    backgroundColor: colors.textMuted,
    borderRadius: 1,
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
