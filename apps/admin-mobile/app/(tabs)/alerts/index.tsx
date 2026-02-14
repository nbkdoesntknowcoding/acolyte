import { useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { format, formatDistanceToNow } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { colors, spacing, fontSize, radius } from "@/lib/theme";
import {
  useAlertCounts,
  useGrievances,
  useNotices,
  useMSRGaps,
  useFeeDefaulters,
  useAttendanceAlerts,
} from "@/lib/hooks/use-alerts";
import { useExpiringRoles } from "@/lib/hooks/use-dashboard";
import { useFlaggedDevices } from "@/lib/hooks/use-devices";
import { Badge } from "@/components/ui/Badge";
import { PullRefresh } from "@/components/ui/PullRefresh";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import type { Grievance, Notice, ExpiringRole } from "@/lib/api/admin-api";

export default function AlertsScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const {
    pendingCount,
    flaggedCount,
    grievanceCount,
    isLoading,
  } = useAlertCounts();

  const { data: expiringData } = useExpiringRoles(7);
  const { data: flaggedData } = useFlaggedDevices();
  const { data: grievancesData } = useGrievances();
  const { data: noticesData } = useNotices(5);
  const { data: msrData } = useMSRGaps();
  const { data: feeData } = useFeeDefaulters();
  const { data: attendanceData } = useAttendanceAlerts();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["admin", "alerts"] }),
      qc.invalidateQueries({ queryKey: ["admin", "grievances"] }),
      qc.invalidateQueries({ queryKey: ["admin", "notices"] }),
      qc.invalidateQueries({ queryKey: ["admin", "msr"] }),
      qc.invalidateQueries({ queryKey: ["admin", "fee-defaulters"] }),
      qc.invalidateQueries({ queryKey: ["admin", "attendance-alerts"] }),
      qc.invalidateQueries({ queryKey: ["admin", "devices", "flagged"] }),
      qc.invalidateQueries({ queryKey: ["admin", "roles", "expiring"] }),
    ]);
    setRefreshing(false);
  }, [qc]);

  const expiringRoles = expiringData?.data ?? [];
  const grievances = grievancesData?.data ?? [];
  const notices = noticesData?.data ?? [];
  const msrGaps = msrData?.data ?? [];

  const overdueGrievances = grievances.filter((g) => {
    const age = Date.now() - new Date(g.filed_at).getTime();
    return age > 7 * 24 * 60 * 60 * 1000; // >7 days
  });

  const hasActionItems =
    pendingCount > 0 ||
    flaggedCount > 0 ||
    overdueGrievances.length > 0 ||
    expiringRoles.length > 0;

  const hasComplianceWarnings =
    msrGaps.length > 0 ||
    (feeData && feeData.overdue_30_days > 0) ||
    (attendanceData && attendanceData.below_threshold_count > 0);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <PullRefresh refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.title}>Alerts</Text>

        {/* Section 1: Action Required */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Action Required</Text>

          {isLoading ? (
            <View style={styles.skeletonWrap}>
              <SkeletonLoader height={56} />
              <SkeletonLoader height={56} />
            </View>
          ) : !hasActionItems ? (
            <View style={styles.allClearBanner}>
              <Text style={styles.allClearEmoji}>✅</Text>
              <Text style={styles.allClearText}>
                Nothing needs your attention right now
              </Text>
            </View>
          ) : (
            <View style={styles.actionList}>
              {pendingCount > 0 && (
                <ActionRow
                  emoji="📋"
                  label={`${pendingCount} pending approval${pendingCount > 1 ? "s" : ""}`}
                  variant="warning"
                  count={pendingCount}
                  onPress={() => router.push("/(tabs)/approvals")}
                />
              )}

              {flaggedCount > 0 && (
                <ActionRow
                  emoji="⚠️"
                  label={`${flaggedCount} flagged device account${flaggedCount > 1 ? "s" : ""}`}
                  variant="error"
                  count={flaggedCount}
                  onPress={() => router.push("/(tabs)/campus")}
                />
              )}

              {overdueGrievances.length > 0 && (
                <ActionRow
                  emoji="📩"
                  label={`${overdueGrievances.length} overdue grievance${overdueGrievances.length > 1 ? "s" : ""} (>7 days)`}
                  variant="error"
                  count={overdueGrievances.length}
                />
              )}

              {expiringRoles.length > 0 && (
                <ActionRow
                  emoji="🔑"
                  label={`${expiringRoles.length} role${expiringRoles.length > 1 ? "s" : ""} expiring this week`}
                  variant="warning"
                  count={expiringRoles.length}
                />
              )}
            </View>
          )}

          {/* Expiring roles detail */}
          {expiringRoles.length > 0 && (
            <View style={styles.subList}>
              {expiringRoles.slice(0, 5).map((role) => (
                <ExpiringRoleRow key={role.id} role={role} />
              ))}
            </View>
          )}
        </View>

        {/* Section 2: Compliance Warnings */}
        {hasComplianceWarnings && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Compliance Warnings</Text>

            {msrGaps.length > 0 &&
              msrGaps.map((dept) => (
                <View key={dept.department_name} style={styles.complianceRow}>
                  <Text style={styles.complianceEmoji}>🏥</Text>
                  <View style={styles.complianceContent}>
                    <Text style={styles.complianceDept}>
                      {dept.department_name}
                    </Text>
                    <Text style={styles.complianceDetail}>
                      {dept.gaps
                        .map(
                          (g) => `need ${g.deficit} ${g.designation}`,
                        )
                        .join(", ")}
                    </Text>
                  </View>
                </View>
              ))}

            {feeData && feeData.overdue_30_days > 0 && (
              <View style={styles.complianceRow}>
                <Text style={styles.complianceEmoji}>💰</Text>
                <View style={styles.complianceContent}>
                  <Text style={styles.complianceDept}>Fee Defaulters</Text>
                  <Text style={styles.complianceDetail}>
                    {feeData.overdue_30_days} students overdue &gt;30 days
                  </Text>
                </View>
              </View>
            )}

            {attendanceData && attendanceData.below_threshold_count > 0 && (
              <View style={styles.complianceRow}>
                <Text style={styles.complianceEmoji}>📊</Text>
                <View style={styles.complianceContent}>
                  <Text style={styles.complianceDept}>Attendance</Text>
                  <Text style={styles.complianceDetail}>
                    {attendanceData.below_threshold_count} students below{" "}
                    {attendanceData.threshold}%
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Section 3: Recent Notices */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Notices</Text>
            <Pressable
              onPress={() => router.push("/modals/notice-compose")}
              style={({ pressed }) => [
                styles.composeBtn,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.composeBtnText}>+ Compose</Text>
            </Pressable>
          </View>

          {notices.length === 0 ? (
            <Text style={styles.emptyText}>No published notices</Text>
          ) : (
            notices.slice(0, 5).map((notice) => (
              <NoticeRow key={notice.id} notice={notice} />
            ))
          )}
        </View>

        {/* Section 4: Open Grievances */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Open Grievances</Text>

          {grievances.length === 0 ? (
            <Text style={styles.emptyText}>No open grievances</Text>
          ) : (
            grievances.slice(0, 5).map((g) => (
              <GrievanceRow
                key={g.id}
                grievance={g}
                onPress={() =>
                  router.push({
                    pathname: "/modals/grievance-update",
                    params: { id: g.id },
                  })
                }
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* FAB for compose */}
      <Pressable
        onPress={() => router.push("/modals/notice-compose")}
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.8 }]}
      >
        <Text style={styles.fabText}>📢</Text>
      </Pressable>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ActionRow({
  emoji,
  label,
  variant,
  count,
  onPress,
}: {
  emoji: string;
  label: string;
  variant: "warning" | "error";
  count: number;
  onPress?: () => void;
}) {
  const bg =
    variant === "error"
      ? "rgba(239, 68, 68, 0.06)"
      : "rgba(245, 158, 11, 0.06)";
  const border =
    variant === "error"
      ? "rgba(239, 68, 68, 0.20)"
      : "rgba(245, 158, 11, 0.20)";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionRow,
        { backgroundColor: bg, borderColor: border },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={styles.actionEmoji}>{emoji}</Text>
      <Text style={styles.actionLabel}>{label}</Text>
      <Badge
        label={String(count)}
        variant={variant}
      />
      {onPress && <Text style={styles.chevron}>›</Text>}
    </Pressable>
  );
}

function ExpiringRoleRow({ role }: { role: ExpiringRole }) {
  return (
    <View style={styles.expiringRow}>
      <View style={styles.expiringInfo}>
        <Text style={styles.expiringName}>{role.user_name}</Text>
        <Text style={styles.expiringRole}>{role.role_name}</Text>
      </View>
      <Text style={styles.expiringDate}>
        {formatDistanceToNow(new Date(role.expires_at), { addSuffix: true })}
      </Text>
    </View>
  );
}

function NoticeRow({ notice }: { notice: Notice }) {
  const priorityVariant =
    notice.priority === "urgent"
      ? ("error" as const)
      : notice.priority === "important"
        ? ("warning" as const)
        : ("outline" as const);

  return (
    <View style={styles.noticeRow}>
      <View style={styles.noticeContent}>
        <View style={styles.noticeHeader}>
          <Text style={styles.noticeTitle} numberOfLines={1}>
            {notice.title}
          </Text>
          {notice.priority !== "normal" && (
            <Badge label={notice.priority} variant={priorityVariant} />
          )}
        </View>
        <View style={styles.noticeMeta}>
          <Text style={styles.noticeDate}>
            {format(new Date(notice.published_at), "d MMM yyyy")}
          </Text>
          <Text style={styles.noticeReads}>
            {notice.read_count} read{notice.read_count !== 1 ? "s" : ""}
          </Text>
        </View>
      </View>
    </View>
  );
}

function GrievanceRow({
  grievance,
  onPress,
}: {
  grievance: Grievance;
  onPress: () => void;
}) {
  const priorityVariant =
    grievance.priority === "urgent" || grievance.priority === "high"
      ? ("error" as const)
      : grievance.priority === "medium"
        ? ("warning" as const)
        : ("outline" as const);

  const statusVariant =
    grievance.status === "open"
      ? ("error" as const)
      : grievance.status === "in_progress"
        ? ("warning" as const)
        : grievance.status === "resolved"
          ? ("success" as const)
          : ("outline" as const);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.grievanceRow,
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={styles.grievanceHeader}>
        <Text style={styles.grievanceTicket}>{grievance.ticket_number}</Text>
        <Badge label={grievance.priority} variant={priorityVariant} />
      </View>
      <Text style={styles.grievanceCategory}>{grievance.category}</Text>
      <View style={styles.grievanceFooter}>
        <Text style={styles.grievanceDate}>
          {formatDistanceToNow(new Date(grievance.filed_at), {
            addSuffix: true,
          })}
        </Text>
        <Badge label={grievance.status.replace(/_/g, " ")} variant={statusVariant} />
      </View>
    </Pressable>
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
    gap: spacing.xl,
    paddingBottom: 100,
  },
  title: {
    fontSize: fontSize["2xl"],
    fontWeight: "800",
    color: colors.textPrimary,
  },

  // Sections
  section: {
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  skeletonWrap: {
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontStyle: "italic",
    paddingVertical: spacing.md,
  },

  // All clear
  allClearBanner: {
    backgroundColor: "rgba(34, 197, 94, 0.06)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.20)",
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.sm,
  },
  allClearEmoji: {
    fontSize: 32,
  },
  allClearText: {
    fontSize: fontSize.base,
    fontWeight: "600",
    color: colors.success,
    textAlign: "center",
  },

  // Action rows
  actionList: {
    gap: spacing.sm,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.lg,
  },
  actionEmoji: {
    fontSize: 18,
  },
  actionLabel: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: colors.textPrimary,
  },
  chevron: {
    fontSize: fontSize.xl,
    color: colors.textMuted,
    fontWeight: "300",
  },

  // Expiring roles sub-list
  subList: {
    gap: spacing.xs,
    paddingLeft: spacing.md,
  },
  expiringRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  expiringInfo: {
    flex: 1,
    gap: 2,
  },
  expiringName: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  expiringRole: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  expiringDate: {
    fontSize: fontSize.xs,
    color: colors.warning,
    fontWeight: "600",
  },

  // Compliance
  complianceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  complianceEmoji: {
    fontSize: 18,
    marginTop: 2,
  },
  complianceContent: {
    flex: 1,
    gap: 2,
  },
  complianceDept: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  complianceDetail: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  // Compose button
  composeBtn: {
    backgroundColor: colors.primaryDim,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  composeBtnText: {
    fontSize: fontSize.xs,
    fontWeight: "700",
    color: colors.primary,
  },

  // Notices
  noticeRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  noticeContent: {
    gap: spacing.xs,
  },
  noticeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  noticeTitle: {
    fontSize: fontSize.base,
    fontWeight: "600",
    color: colors.textPrimary,
    flex: 1,
  },
  noticeMeta: {
    flexDirection: "row",
    gap: spacing.md,
  },
  noticeDate: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  noticeReads: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },

  // Grievances
  grievanceRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  grievanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  grievanceTicket: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  grievanceCategory: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textTransform: "capitalize",
  },
  grievanceFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  grievanceDate: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  // FAB
  fab: {
    position: "absolute",
    bottom: 24,
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabText: {
    fontSize: 24,
  },
});
