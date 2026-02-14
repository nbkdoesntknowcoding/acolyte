import { useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, fontSize, radius } from "@/lib/theme";
import { useActionPoints, useActionPointStats } from "@/lib/hooks/use-scan-logs";
import { Badge } from "@/components/ui/Badge";
import { MiniSparkline } from "@/components/dashboard/MiniSparkline";
import { PullRefresh } from "@/components/ui/PullRefresh";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import type { QRActionPoint } from "@/lib/api/qr-api";

const ACTION_ICON: Record<string, string> = {
  mess_entry: "coffee",
  library_checkout: "book-open",
  library_return: "book",
  attendance_mark: "check-square",
  hostel_checkin: "home",
  lab_access: "activity",
  exam_hall_entry: "edit-3",
  parking_entry: "square",
  event_checkin: "calendar",
};

export function QRPointsView() {
  const { data: points, isLoading, isRefetching, refetch } = useActionPoints();

  return (
    <FlatList
      data={points ?? []}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      refreshControl={
        <PullRefresh refreshing={isRefetching} onRefresh={refetch} />
      }
      renderItem={({ item }) => <ActionPointCard point={item} />}
      ListEmptyComponent={
        isLoading ? (
          <View style={styles.skeletonWrap}>
            {[1, 2, 3].map((i) => (
              <SkeletonLoader key={i} height={120} />
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>No active QR action points</Text>
        )
      }
    />
  );
}

function ActionPointCard({ point }: { point: QRActionPoint }) {
  const [expanded, setExpanded] = useState(false);
  const { data: stats } = useActionPointStats(point.id, 7);
  const iconName = ACTION_ICON[point.action_type] ?? "file";

  const todayScans = stats?.total_scans ?? 0;
  const successRate = stats?.success_rate ?? 0;

  // Build hourly bars from daily breakdown (approximate)
  const dailyData = stats?.daily_breakdown?.map((d) => d.count) ?? [];

  // Find peak hour (rough — based on daily breakdown peak day)
  const peakDay = stats?.daily_breakdown?.reduce(
    (max, d) => (d.count > max.count ? d : max),
    { date: "", count: 0 },
  );

  return (
    <Pressable
      onPress={() => setExpanded(!expanded)}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Feather name={iconName as any} size={18} color={colors.textMuted} />
          <Text style={styles.cardName} numberOfLines={1}>
            {point.name}
          </Text>
        </View>
        <Badge
          label={point.is_active ? "Active" : "Inactive"}
          variant={point.is_active ? "success" : "outline"}
        />
      </View>

      <Text style={styles.cardMeta}>
        Mode {point.qr_mode === "mode_a" ? "A" : "B"} · Standard security
      </Text>
      {(point.building || point.floor) && (
        <Text style={styles.cardLocation}>
          {[point.building, point.floor ? `${point.floor} Floor` : ""]
            .filter(Boolean)
            .join(", ")}
        </Text>
      )}

      <View style={styles.cardDivider} />

      <View style={styles.statsRow}>
        <Text style={styles.statText}>
          Today:{" "}
          <Text style={styles.statHighlight}>{todayScans} scans</Text>
        </Text>
        <Text style={styles.statText}>
          <Text
            style={[
              styles.statHighlight,
              {
                color:
                  successRate >= 95
                    ? colors.success
                    : successRate >= 80
                      ? colors.warning
                      : colors.error,
              },
            ]}
          >
            {successRate.toFixed(1)}%
          </Text>{" "}
          success
        </Text>
      </View>

      {dailyData.length > 0 && (
        <MiniSparkline data={dailyData} height={28} />
      )}

      {expanded && stats && (
        <View style={styles.expandedArea}>
          <View style={styles.cardDivider} />
          <Text style={styles.expandedTitle}>Weekly Trend</Text>
          {stats.daily_breakdown.map((d) => (
            <View key={d.date} style={styles.breakdownRow}>
              <Text style={styles.breakdownDate}>{d.date.slice(5)}</Text>
              <View style={styles.breakdownBar}>
                <View
                  style={[
                    styles.breakdownFill,
                    {
                      width: `${Math.min(
                        (d.count / Math.max(peakDay?.count ?? 1, 1)) * 100,
                        100,
                      )}%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.breakdownCount}>{d.count}</Text>
            </View>
          ))}
          {stats.total_scans > 0 && stats.successful_scans < stats.total_scans && (
            <Text style={styles.failureNote}>
              {stats.total_scans - stats.successful_scans} failures in the last
              7 days
            </Text>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing["4xl"],
  },
  skeletonWrap: {
    gap: spacing.md,
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: "center",
    paddingVertical: spacing["4xl"],
  },

  // Card
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  cardName: {
    fontSize: fontSize.base,
    fontWeight: "700",
    color: colors.textPrimary,
    flex: 1,
  },
  cardMeta: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    paddingLeft: 26,
  },
  cardLocation: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    paddingLeft: 26,
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  statHighlight: {
    fontWeight: "700",
    color: colors.textPrimary,
  },

  // Expanded
  expandedArea: {
    gap: spacing.sm,
  },
  expandedTitle: {
    fontSize: fontSize.xs,
    fontWeight: "700",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  breakdownDate: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    width: 40,
  },
  breakdownBar: {
    flex: 1,
    height: 6,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 3,
    overflow: "hidden",
  },
  breakdownFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  breakdownCount: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontWeight: "600",
    width: 30,
    textAlign: "right",
  },
  failureNote: {
    fontSize: fontSize.xs,
    color: colors.error,
    fontStyle: "italic",
  },
});
