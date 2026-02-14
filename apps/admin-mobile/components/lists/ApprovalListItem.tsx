import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors, radius, spacing, fontSize } from "@/lib/theme";
import { Badge } from "@/components/ui/Badge";
import { formatDistanceToNow } from "date-fns";

interface ApprovalListItemProps {
  id: string;
  type: string;
  title: string;
  submittedBy: string;
  submittedAt: string;
  priority: string;
  onPress: (id: string) => void;
}

export function ApprovalListItem({
  id,
  type,
  title,
  submittedBy,
  submittedAt,
  priority,
  onPress,
}: ApprovalListItemProps) {
  const priorityVariant =
    priority === "high" || priority === "urgent"
      ? ("error" as const)
      : priority === "medium"
        ? ("warning" as const)
        : ("outline" as const);

  const timeAgo = formatDistanceToNow(new Date(submittedAt), { addSuffix: true });

  return (
    <Pressable
      onPress={() => onPress(id)}
      style={({ pressed }) => [styles.container, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.header}>
        <Badge label={type.replace(/_/g, " ")} variant="info" />
        <Badge label={priority} variant={priorityVariant} />
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      <View style={styles.footer}>
        <Text style={styles.meta}>{submittedBy}</Text>
        <Text style={styles.meta}>{timeAgo}</Text>
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
  title: {
    fontSize: fontSize.base,
    fontWeight: "600",
    color: colors.textPrimary,
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
