import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors, radius, spacing, fontSize } from "@/lib/theme";
import { Badge } from "@/components/ui/Badge";

interface ApprovalPreviewProps {
  title: string;
  submittedBy: string;
  priority: string;
  onPress: () => void;
}

export function ApprovalPreview({
  title,
  submittedBy,
  priority,
  onPress,
}: ApprovalPreviewProps) {
  const variant =
    priority === "high" || priority === "urgent"
      ? "error"
      : priority === "medium"
        ? "warning"
        : "outline";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.container, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.sub}>{submittedBy}</Text>
      </View>
      <Badge label={priority} variant={variant} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: fontSize.base,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  sub: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
});
