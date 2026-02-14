import { useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { formatDistanceToNow } from "date-fns";
import { colors, spacing, fontSize, radius } from "@/lib/theme";
import {
  useDeviceStats,
  useDeviceSearch,
  useDevices,
  useFlaggedDevices,
} from "@/lib/hooks/use-devices";
import { SearchBar } from "@/components/ui/SearchBar";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { PullRefresh } from "@/components/ui/PullRefresh";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import type { DeviceTrust } from "@/lib/api/device-api";

export function DevicesView() {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const { data: stats } = useDeviceStats();
  const { data: flaggedData } = useFlaggedDevices();
  const {
    data: allDevices,
    isRefetching: allRefetching,
    refetch: allRefetch,
  } = useDevices({ page_size: 50 });
  const { data: searchResults, isLoading: searchLoading } =
    useDeviceSearch(search);

  const flaggedCount = flaggedData?.count ?? 0;
  const flaggedList = flaggedData?.data ?? [];
  const devices = search.length >= 2 ? searchResults ?? [] : allDevices ?? [];

  return (
    <FlatList
      data={devices}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      refreshControl={
        <PullRefresh refreshing={allRefetching} onRefresh={allRefetch} />
      }
      ListHeaderComponent={
        <View style={styles.headerArea}>
          {/* Stats row */}
          {stats && (
            <View style={styles.statsRow}>
              <StatCard
                label="Active"
                value={stats.active_count}
                color={colors.success}
              />
              <StatCard label="Total" value={stats.total_registered} />
              <StatCard
                label="This Week"
                value={stats.registered_this_week ?? 0}
                color={colors.info}
              />
            </View>
          )}

          {/* Flagged accounts */}
          {flaggedCount > 0 && (
            <View style={styles.flaggedSection}>
              <View style={styles.flaggedBanner}>
                <Text style={styles.flaggedTitle}>
                  <Feather name="alert-triangle" size={14} color={colors.warning} />{" "}
                  {flaggedCount} account{flaggedCount > 1 ? "s" : ""} flagged
                  for suspicious resets
                </Text>
              </View>
              {flaggedList.slice(0, 3).map((d) => (
                <View key={d.id} style={styles.flaggedItem}>
                  <View style={styles.flaggedInfo}>
                    <Text style={styles.flaggedName} numberOfLines={1}>
                      {d.user_name ?? d.user_id.slice(0, 12)}
                    </Text>
                    <Text style={styles.flaggedMeta}>
                      Resets: {d.reset_count ?? "?"} · Last:{" "}
                      {d.last_reset_at
                        ? formatDistanceToNow(new Date(d.last_reset_at), {
                            addSuffix: true,
                          })
                        : "unknown"}
                    </Text>
                  </View>
                  <View style={styles.flaggedActions}>
                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: "/(tabs)/campus/device-detail",
                          params: { userId: d.user_id },
                        })
                      }
                      style={styles.flaggedBtn}
                    >
                      <Text style={styles.flaggedBtnText}>View</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Search */}
          <SearchBar
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name or phone..."
          />
        </View>
      }
      renderItem={({ item }) => (
        <DeviceRow
          device={item}
          onPress={() =>
            router.push({
              pathname: "/(tabs)/campus/device-detail",
              params: { userId: item.user_id },
            })
          }
        />
      )}
      ListEmptyComponent={
        searchLoading ? (
          <View style={styles.skeletonWrap}>
            <SkeletonLoader height={64} />
            <SkeletonLoader height={64} />
          </View>
        ) : search.length >= 2 ? (
          <Text style={styles.emptyText}>No devices match "{search}"</Text>
        ) : null
      }
    />
  );
}

function DeviceRow({
  device,
  onPress,
}: {
  device: DeviceTrust;
  onPress: () => void;
}) {
  const statusVariant =
    device.status === "active"
      ? ("success" as const)
      : device.status === "revoked"
        ? ("error" as const)
        : ("outline" as const);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.deviceRow, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.deviceHeader}>
        <Text style={styles.deviceName} numberOfLines={1}>
          {device.user_name ?? device.user_id.slice(0, 14)}
        </Text>
        <Badge label={device.status} variant={statusVariant} />
      </View>
      <View style={styles.deviceFooter}>
        <Text style={styles.deviceMeta}>
          {device.device_model} · {device.platform}
        </Text>
        <Text style={styles.deviceMeta}>
          {formatDistanceToNow(new Date(device.last_active_at), {
            addSuffix: true,
          })}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingBottom: spacing["4xl"],
  },
  headerArea: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },

  // Flagged
  flaggedSection: {
    gap: spacing.sm,
  },
  flaggedBanner: {
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.25)",
    padding: spacing.md,
  },
  flaggedTitle: {
    fontSize: fontSize.sm,
    color: colors.warning,
    fontWeight: "600",
  },
  flaggedItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  flaggedInfo: {
    flex: 1,
    gap: 2,
  },
  flaggedName: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  flaggedMeta: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  flaggedActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  flaggedBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  flaggedBtnText: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: colors.primary,
  },

  // Skeleton
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

  // Device row
  deviceRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  deviceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  deviceName: {
    fontSize: fontSize.base,
    fontWeight: "600",
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.sm,
  },
  deviceFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  deviceMeta: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
});
