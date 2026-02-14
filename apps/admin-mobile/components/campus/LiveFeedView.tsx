import { useState, useMemo } from "react";
import { View, Text, FlatList, ScrollView, Pressable, StyleSheet } from "react-native";
import { colors, spacing, fontSize, radius } from "@/lib/theme";
import { useScanLogs, useScanLogSummary, useScanLogAnomalies } from "@/lib/hooks/use-scan-logs";
import { ScanLogItem } from "@/components/lists/ScanLogItem";
import { PullRefresh } from "@/components/ui/PullRefresh";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";

type Filter =
  | "all"
  | "mess_entry"
  | "library_checkout"
  | "attendance_mark"
  | "hostel_checkin"
  | "lab_access";

const FILTERS: { key: Filter; label: string; emoji: string }[] = [
  { key: "all", label: "All", emoji: "" },
  { key: "mess_entry", label: "Mess", emoji: "🍽️" },
  { key: "library_checkout", label: "Library", emoji: "📚" },
  { key: "attendance_mark", label: "Attendance", emoji: "✅" },
  { key: "hostel_checkin", label: "Hostel", emoji: "🏠" },
  { key: "lab_access", label: "Clinical", emoji: "🏥" },
];

export function LiveFeedView() {
  const [filter, setFilter] = useState<Filter>("all");

  const params =
    filter === "all"
      ? { page_size: 30 }
      : { action_type: filter, page_size: 30 };

  const {
    data: logs,
    isLoading,
    isRefetching,
    refetch,
  } = useScanLogs(params, { refetchInterval: 10_000 });
  const { data: summary } = useScanLogSummary(1);
  const { data: anomalies } = useScanLogAnomalies(1);

  // Compute stats
  const totalToday = useMemo(
    () => summary?.data?.reduce((s, d) => s + d.count, 0) ?? 0,
    [summary],
  );
  const failuresToday = useMemo(
    () => anomalies?.anomalies?.reduce((s, a) => s + a.count, 0) ?? 0,
    [anomalies],
  );
  const successRate =
    totalToday > 0
      ? (((totalToday - failuresToday) / totalToday) * 100).toFixed(1)
      : "0.0";

  // Recent 5 min count (approximate from logs)
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  const activeNow = useMemo(
    () =>
      logs?.filter((l) => new Date(l.scanned_at).getTime() > fiveMinAgo)
        .length ?? 0,
    [logs, fiveMinAgo],
  );

  // Top anomaly
  const topAnomaly = useMemo(() => {
    if (!anomalies?.anomalies?.length) return null;
    const sorted = [...anomalies.anomalies].sort((a, b) => b.count - a.count);
    return sorted[0];
  }, [anomalies]);

  return (
    <FlatList
      data={logs ?? []}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      refreshControl={
        <PullRefresh refreshing={isRefetching} onRefresh={refetch} />
      }
      ListHeaderComponent={
        <View style={styles.headerArea}>
          {/* Stats strip */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statsStrip}
          >
            <StatPill label="Total Today" value={String(totalToday)} />
            <StatPill
              label="Success Rate"
              value={`${successRate}%`}
              color={Number(successRate) > 95 ? colors.success : colors.warning}
            />
            <StatPill label="Active Now" value={String(activeNow)} color={colors.info} />
            <StatPill
              label="Failures"
              value={String(failuresToday)}
              color={failuresToday > 0 ? colors.error : colors.textMuted}
            />
          </ScrollView>

          {/* Anomaly banner */}
          {failuresToday > 10 && topAnomaly && (
            <View style={styles.anomalyBanner}>
              <Text style={styles.anomalyText}>
                ⚠️ {failuresToday} scan failures today — most common:{" "}
                {topAnomaly.rejection_reason.replace(/_/g, " ")} (
                {topAnomaly.count})
              </Text>
            </View>
          )}

          {/* Filter chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {FILTERS.map((f) => (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={[
                  styles.filterChip,
                  filter === f.key && styles.filterActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    filter === f.key && styles.filterTextActive,
                  ]}
                >
                  {f.emoji ? `${f.emoji} ` : ""}
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      }
      renderItem={({ item }) => (
        <ScanLogItem
          actionType={item.action_type}
          validationResult={item.validation_result}
          rejectionReason={item.rejection_reason}
          userId={item.user_id}
          userName={item.user_name}
          actionPointName={item.action_point_name}
          geoValidated={item.geo_validated}
          deviceValidated={item.device_validated}
          deviceModel={item.device_model}
          qrMode={item.qr_mode}
          scannedAt={item.scanned_at}
        />
      )}
      ListEmptyComponent={
        isLoading ? (
          <View style={styles.skeletonWrap}>
            {[1, 2, 3, 4, 5].map((i) => (
              <SkeletonLoader key={i} height={56} />
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>No scan logs yet today</Text>
        )
      }
    />
  );
}

function StatPill({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View style={styles.statPill}>
      <Text style={[styles.statValue, color ? { color } : undefined]}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingBottom: spacing["4xl"],
  },
  headerArea: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  statsStrip: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  statPill: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    alignItems: "center",
    gap: 2,
    minWidth: 85,
  },
  statValue: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  anomalyBanner: {
    marginHorizontal: spacing.lg,
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.25)",
    padding: spacing.md,
  },
  anomalyText: {
    fontSize: fontSize.sm,
    color: colors.warning,
    fontWeight: "500",
  },
  filterRow: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterActive: {
    backgroundColor: colors.primaryDim,
    borderColor: colors.primary,
  },
  filterText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontWeight: "600",
  },
  filterTextActive: {
    color: colors.primary,
  },
  skeletonWrap: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: "center",
    paddingVertical: spacing["4xl"],
  },
});
