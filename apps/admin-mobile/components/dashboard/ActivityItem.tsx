import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, radius, spacing, fontSize } from "@/lib/theme";
import { formatDistanceToNow } from "date-fns";

interface ActivityItemProps {
  type: string;
  description: string;
  timestamp: string;
}

const TYPE_ICON: Record<string, React.ComponentProps<typeof Feather>["name"]> = {
  leave_approved: "check-circle",
  leave_rejected: "x-circle",
  student_enrolled: "user-plus",
  device_reset: "smartphone",
  notice_published: "volume-2",
  fee_received: "dollar-sign",
  certificate_issued: "file-text",
  faculty_joined: "user-check",
  role_assigned: "key",
};

export function ActivityItem({ type, description, timestamp }: ActivityItemProps) {
  const icon = TYPE_ICON[type] ?? "file";
  const timeAgo = formatDistanceToNow(new Date(timestamp), { addSuffix: true });

  return (
    <View style={styles.row}>
      <Feather name={icon} size={16} color={colors.textMuted} style={styles.icon} />
      <View style={styles.content}>
        <Text style={styles.description} numberOfLines={2}>
          {description}
        </Text>
        <Text style={styles.time}>{timeAgo}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  icon: {
    marginTop: 2,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  description: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },
  time: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
});
