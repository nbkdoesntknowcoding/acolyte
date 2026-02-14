import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors, radius, spacing, fontSize } from "@/lib/theme";
import { Badge } from "@/components/ui/Badge";
import { formatDistanceToNow } from "date-fns";

interface DeviceListItemProps {
  deviceModel: string;
  platform: string;
  status: string;
  totalScans: number;
  lastActiveAt: string;
  userId: string;
  onPress: () => void;
}

export function DeviceListItem({
  deviceModel,
  platform,
  status,
  totalScans,
  lastActiveAt,
  onPress,
}: DeviceListItemProps) {
  const statusVariant =
    status === "active"
      ? ("success" as const)
      : status === "revoked"
        ? ("error" as const)
        : ("outline" as const);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.container, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.header}>
        <Text style={styles.model} numberOfLines={1}>
          {deviceModel}
        </Text>
        <Badge label={status} variant={statusVariant} />
      </View>
      <View style={styles.footer}>
        <Text style={styles.meta}>
          {platform} · {totalScans} scans
        </Text>
        <Text style={styles.meta}>
          {formatDistanceToNow(new Date(lastActiveAt), { addSuffix: true })}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  model: {
    fontSize: fontSize.base,
    fontWeight: "600",
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.sm,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  meta: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
});
