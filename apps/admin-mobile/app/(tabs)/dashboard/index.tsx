import { useCallback, useState, useEffect } from "react";
import { View, Text, ScrollView, RefreshControl, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { colors, spacing, fontSize, radius } from "@/lib/theme";
import {
  useMe,
  useDashboardStats,
  usePendingApprovals,
  useRecentActivity,
  useApproveWorkflow,
  useRejectWorkflow,
  useFlaggedDevices,
  useExpiringRoles,
  useHourlyScanVolume,
} from "@/lib/hooks/use-dashboard";
import { useScanLogSummary, useScanLogAnomalies } from "@/lib/hooks/use-scan-logs";
import { StatCard } from "@/components/ui/StatCard";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { CampusPulseCard } from "@/components/dashboard/CampusPulseCard";
import { ApprovalActionCard } from "@/components/dashboard/ApprovalActionCard";
import { AlertItem } from "@/components/dashboard/AlertItem";
import { ActivityItem } from "@/components/dashboard/ActivityItem";

function formatCurrency(amount: number): string {
  if (amount >= 1_00_00_000) return `₹${(amount / 1_00_00_000).toFixed(1)} Cr`;
  if (amount >= 1_00_000) return `₹${(amount / 1_00_000).toFixed(1)} L`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function DashboardScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  // --- Smoke test: backend connectivity (remove after testing) ---
  const [backendStatus, setBackendStatus] = useState<string>("checking...");
  useEffect(() => {
    const apiUrl =
      Constants.expoConfig?.extra?.apiUrl ??
      process.env.EXPO_PUBLIC_API_URL ??
      "https://acolyte-api.fly.dev";
    fetch(`${apiUrl}/health`)
      .then((res) => res.json())
      .then((data) =>
        setBackendStatus(`Backend: ${data.status ?? "unknown"}`),
      )
      .catch((err) =>
        setBackendStatus(`Backend unreachable: ${err.message}`),
      );
  }, []);

  // Data hooks
  const { data: me } = useMe();
  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } = useDashboardStats();
  const { data: approvals, isLoading: approvalsLoading, isError: approvalsError, refetch: refetchApprovals } = usePendingApprovals(5);
  const { data: activity, isLoading: activityLoading, isError: activityError, refetch: refetchActivity } = useRecentActivity(5);
  const { data: summary, isLoading: summaryLoading, isError: summaryError, refetch: refetchSummary } = useScanLogSummary(1);
  const { data: hourly } = useHourlyScanVolume();
  const { data: flaggedData } = useFlaggedDevices();
  const { data: anomaliesData } = useScanLogAnomalies(7);
  const { data: expiringData } = useExpiringRoles(7);

  // Mutations
  const approveMutation = useApproveWorkflow();
  const rejectMutation = useRejectWorkflow();

  // Computed values
  const pendingList = approvals?.data ?? [];
  const activityList = activity?.data ?? [];
  const flaggedCount = flaggedData?.count ?? 0;
  const anomalyCount = anomaliesData?.anomalies?.reduce((s, a) => s + a.count, 0) ?? 0;
  const expiringCount = expiringData?.data?.length ?? 0;
  const hasAlerts = flaggedCount > 0 || anomalyCount > 0 || expiringCount > 0;

  // Campus today from scan summary
  const todayMess = summary?.data?.filter((d) => d.action_type === "mess_entry").reduce((s, d) => s + d.count, 0) ?? 0;
  const todayLibrary = summary?.data?.filter((d) => d.action_type === "library_checkout").reduce((s, d) => s + d.count, 0) ?? 0;
  const todayAttendance = summary?.data?.filter((d) => d.action_type === "attendance_mark").reduce((s, d) => s + d.count, 0) ?? 0;
  const todayHostel = summary?.data?.filter((d) => d.action_type === "hostel_checkin").reduce((s, d) => s + d.count, 0) ?? 0;

  // Hourly sparkline data — last 12 hours
  const hourlyBars: number[] = Array(24).fill(0);
  if (hourly?.data) {
    for (const h of hourly.data) {
      if (h.hour >= 0 && h.hour < 24) hourlyBars[h.hour] = h.count;
    }
  }
  const currentHour = new Date().getHours();
  const sparklineData = hourlyBars.slice(
    Math.max(0, currentHour - 11),
    currentHour + 1,
  );

  // Fee collection
  const feeCollected = stats?.fee_collection?.collected ?? 0;
  const feeTotal = stats?.fee_collection?.total ?? 1;
  const feePercent = Math.round((feeCollected / feeTotal) * 100);

  // Approval count color
  const approvalCount = pendingList.length;
  const approvalColor =
    approvalCount > 15
      ? colors.error
      : approvalCount > 5
        ? colors.warning
        : colors.textPrimary;

  // Name formatting
  const displayName = me?.full_name?.split(" ")[0] ?? "Admin";

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refetchStats(),
      refetchApprovals(),
      refetchActivity(),
      refetchSummary(),
      qc.invalidateQueries({ queryKey: ["admin", "devices", "flagged"] }),
      qc.invalidateQueries({ queryKey: ["admin", "roles", "expiring"] }),
      qc.invalidateQueries({ queryKey: ["admin", "qr", "hourly-volume"] }),
      qc.invalidateQueries({ queryKey: ["admin", "qr", "anomalies"] }),
    ]);
    setRefreshing(false);
  }, [refetchStats, refetchApprovals, refetchActivity, refetchSummary, qc]);

  // Retry handler for errored sections
  const retrySection = (refetchFn: () => void) => (
    <Pressable onPress={() => refetchFn()} style={styles.retryWrap}>
      <Text style={styles.retryText}>Failed to load. Tap to retry.</Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* ── Smoke test banner (remove after testing) ── */}
        <Text
          style={{
            color: backendStatus.includes("healthy") ? "#22c55e" : "#ef4444",
            fontSize: 13,
            fontWeight: "600",
            textAlign: "center",
            paddingVertical: 6,
            backgroundColor: backendStatus.includes("healthy")
              ? "rgba(34,197,94,0.1)"
              : "rgba(239,68,68,0.1)",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          {backendStatus.includes("healthy") ? "\u2705" : "\u274C"}{" "}
          {backendStatus}
        </Text>

        {/* ── Section 1: Greeting + Date ── */}
        <View style={styles.greetingSection}>
          <Text style={styles.greeting}>
            {getGreeting()}, {displayName}
          </Text>
          <Text style={styles.date}>
            {format(new Date(), "EEEE, d MMMM yyyy")}
          </Text>
          {me?.org_slug && (
            <Text style={styles.college}>{me.org_slug.replace(/-/g, " ")}</Text>
          )}
        </View>

        {/* ── Section 2: Key Numbers (2×2 grid) ── */}
        {statsLoading ? (
          <View style={styles.statsGrid}>
            <View style={styles.statsRow}>
              <SkeletonLoader height={90} />
              <SkeletonLoader height={90} />
            </View>
            <View style={styles.statsRow}>
              <SkeletonLoader height={90} />
              <SkeletonLoader height={90} />
            </View>
          </View>
        ) : statsError ? (
          retrySection(refetchStats)
        ) : (
          <View style={styles.statsGrid}>
            <View style={styles.statsRow}>
              <StatCard
                label="Students"
                value={stats?.students?.total ?? 0}
                subLabel="Active"
                subColor={colors.success}
              />
              <StatCard
                label="Faculty"
                value={stats?.faculty?.total ?? 0}
                progress={stats?.compliance_score ?? 0}
                progressColor={
                  (stats?.compliance_score ?? 0) >= 80
                    ? colors.success
                    : colors.warning
                }
                subLabel={`${stats?.compliance_score ?? 0}% MSR`}
                subColor={
                  (stats?.compliance_score ?? 0) >= 80
                    ? colors.success
                    : colors.warning
                }
              />
            </View>
            <View style={styles.statsRow}>
              <StatCard
                label="Fee Collection"
                value={formatCurrency(feeCollected)}
                progress={feePercent}
                progressColor={feePercent >= 70 ? colors.success : colors.warning}
                subLabel={`${feePercent}% of target`}
                subColor={colors.textMuted}
              />
              <StatCard
                label="Approvals"
                value={approvalCount}
                color={approvalColor}
                subLabel="pending"
                subColor={colors.textMuted}
                onPress={() => router.push("/(tabs)/approvals")}
              />
            </View>
          </View>
        )}

        {/* ── Section 3: Campus Activity ── */}
        {summaryLoading ? (
          <SkeletonLoader height={140} />
        ) : summaryError ? (
          retrySection(refetchSummary)
        ) : (
          <CampusPulseCard
            items={[
              { label: "meals", value: todayMess, emoji: "🍽️" },
              { label: "checkouts", value: todayLibrary, emoji: "📚" },
              { label: "attendance", value: todayAttendance, emoji: "✅" },
              { label: "hostel", value: todayHostel, emoji: "🏠" },
            ]}
            hourlyData={sparklineData.length > 0 ? sparklineData : undefined}
            onPress={() => router.push("/(tabs)/campus")}
          />
        )}

        {/* ── Section 4: Approvals Needing Action ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Approvals</Text>
            {approvalCount > 0 && (
              <Pressable onPress={() => router.push("/(tabs)/approvals")}>
                <Text style={styles.viewAll}>
                  View All ({approvalCount})
                </Text>
              </Pressable>
            )}
          </View>
          {approvalsLoading ? (
            <SkeletonLoader height={80} />
          ) : approvalsError ? (
            retrySection(refetchApprovals)
          ) : pendingList.length === 0 ? (
            <View style={styles.allCaughtUp}>
              <Text style={styles.allCaughtUpEmoji}>✅</Text>
              <Text style={styles.allCaughtUpText}>All caught up!</Text>
            </View>
          ) : (
            <View style={styles.approvalCards}>
              {pendingList.slice(0, 3).map((a) => (
                <ApprovalActionCard
                  key={a.id}
                  id={a.id}
                  title={a.title}
                  submittedBy={a.submitted_by}
                  type={a.type}
                  onApprove={(id) => approveMutation.mutate(id)}
                  onReject={(id) => rejectMutation.mutate({ id })}
                  onPress={() =>
                    router.push({
                      pathname: "/(tabs)/approvals/[id]",
                      params: { id: a.id, kind: a.type },
                    })
                  }
                  isApproving={
                    approveMutation.isPending &&
                    approveMutation.variables === a.id
                  }
                  isRejecting={
                    rejectMutation.isPending &&
                    rejectMutation.variables?.id === a.id
                  }
                />
              ))}
            </View>
          )}
        </View>

        {/* ── Section 5: Alerts ── */}
        {hasAlerts && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Alerts</Text>
            <View style={styles.alertList}>
              {flaggedCount > 0 && (
                <AlertItem
                  icon="⚠️"
                  message={`${flaggedCount} flagged device account${flaggedCount > 1 ? "s" : ""}`}
                  variant="warning"
                  onPress={() => router.push("/(tabs)/campus")}
                />
              )}
              {anomalyCount > 0 && (
                <AlertItem
                  icon="🔴"
                  message={`${anomalyCount} failed QR scans in the last 7 days`}
                  variant="error"
                  onPress={() => router.push("/(tabs)/alerts")}
                />
              )}
              {expiringCount > 0 && (
                <AlertItem
                  icon="⏰"
                  message={`${expiringCount} role assignment${expiringCount > 1 ? "s" : ""} expiring this week`}
                  variant="warning"
                />
              )}
            </View>
          </View>
        )}

        {/* ── Section 6: Recent Activity ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <Pressable onPress={() => router.push("/(tabs)/alerts")}>
              <Text style={styles.viewAll}>View All</Text>
            </Pressable>
          </View>
          {activityLoading ? (
            <View style={styles.activitySkeleton}>
              <SkeletonLoader height={40} />
              <SkeletonLoader height={40} />
              <SkeletonLoader height={40} />
            </View>
          ) : activityError ? (
            retrySection(refetchActivity)
          ) : activityList.length === 0 ? (
            <Text style={styles.emptyText}>No recent activity</Text>
          ) : (
            <View style={styles.activityList}>
              {activityList.slice(0, 5).map((a) => (
                <ActivityItem
                  key={a.id}
                  type={a.type}
                  description={a.description}
                  timestamp={a.timestamp}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.xl,
    paddingBottom: spacing["4xl"],
  },

  // Greeting
  greetingSection: {
    gap: spacing.xs,
  },
  greeting: {
    fontSize: fontSize["2xl"],
    fontWeight: "800",
    color: colors.textPrimary,
  },
  date: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
  },
  college: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textTransform: "capitalize",
  },

  // Stats grid
  statsGrid: {
    gap: spacing.sm,
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },

  // Sections
  section: {
    gap: spacing.md,
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
  viewAll: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.primary,
  },

  // All caught up
  allCaughtUp: {
    backgroundColor: "rgba(34, 197, 94, 0.08)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.20)",
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.xs,
  },
  allCaughtUpEmoji: {
    fontSize: 24,
  },
  allCaughtUpText: {
    fontSize: fontSize.base,
    fontWeight: "600",
    color: colors.success,
  },

  // Approval cards
  approvalCards: {
    gap: spacing.sm,
  },

  // Alerts
  alertList: {
    gap: spacing.sm,
  },

  // Activity
  activityList: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  activitySkeleton: {
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: "center",
    paddingVertical: spacing.xl,
  },

  // Retry
  retryWrap: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: "center",
  },
  retryText: {
    fontSize: fontSize.sm,
    color: colors.warning,
    fontWeight: "500",
  },
});
