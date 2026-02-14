import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

interface ApprovalActionCardProps {
  id: string;
  title: string;
  submittedBy: string;
  type: string;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onPress?: () => void;
  isApproving?: boolean;
  isRejecting?: boolean;
}

const TYPE_EMOJI: Record<string, string> = {
  leave: "🏖️",
  certificate: "📜",
  transfer: "🔄",
  enrollment: "🎓",
  fee_waiver: "💰",
};

export function ApprovalActionCard({
  id,
  title,
  submittedBy,
  type,
  onApprove,
  onReject,
  onPress,
  isApproving,
  isRejecting,
}: ApprovalActionCardProps) {
  const emoji = TYPE_EMOJI[type] ?? "📋";
  const busy = isApproving || isRejecting;

  const handleApprove = () => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    onApprove(id);
  };

  const handleReject = () => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    onReject(id);
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && onPress ? { opacity: 0.85 } : undefined,
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.emoji}>{emoji}</Text>
        <View style={styles.textWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {submittedBy}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable
          onPress={handleApprove}
          disabled={busy}
          style={({ pressed }) => [
            styles.btn,
            styles.approveBtn,
            pressed && { opacity: 0.7 },
            busy && { opacity: 0.4 },
          ]}
        >
          <Text style={styles.approveTxt}>
            {isApproving ? "..." : "Approve"}
          </Text>
        </Pressable>
        <Pressable
          onPress={handleReject}
          disabled={busy}
          style={({ pressed }) => [
            styles.btn,
            styles.rejectBtn,
            pressed && { opacity: 0.7 },
            busy && { opacity: 0.4 },
          ]}
        >
          <Text style={styles.rejectTxt}>
            {isRejecting ? "..." : "Reject"}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  emoji: {
    fontSize: 20,
  },
  textWrap: {
    flex: 1,
    gap: 1,
  },
  title: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  sub: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "flex-end",
  },
  btn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  approveBtn: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
  },
  approveTxt: {
    fontSize: fontSize.xs,
    fontWeight: "700",
    color: colors.success,
  },
  rejectBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
  },
  rejectTxt: {
    fontSize: fontSize.xs,
    fontWeight: "700",
    color: colors.error,
  },
});
