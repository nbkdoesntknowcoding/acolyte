import { View, Text, StyleSheet } from "react-native";
import { colors, radius, spacing, fontSize } from "@/lib/theme";
import { formatDistanceToNow } from "date-fns";

interface ActivityItemProps {
  type: string;
  description: string;
  timestamp: string;
}

const TYPE_EMOJI: Record<string, string> = {
  leave_approved: "✅",
  leave_rejected: "❌",
  student_enrolled: "🎓",
  device_reset: "📱",
  notice_published: "📢",
  fee_received: "💰",
  certificate_issued: "📜",
  faculty_joined: "👨‍🏫",
  role_assigned: "🔑",
};

export function ActivityItem({ type, description, timestamp }: ActivityItemProps) {
  const emoji = TYPE_EMOJI[type] ?? "📋";
  const timeAgo = formatDistanceToNow(new Date(timestamp), { addSuffix: true });

  return (
    <View style={styles.row}>
      <Text style={styles.emoji}>{emoji}</Text>
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
  emoji: {
    fontSize: 16,
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
