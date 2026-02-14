import { useRef } from "react";
import { View, Text, Pressable, StyleSheet, Animated, Platform } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, radius, spacing, fontSize } from "@/lib/theme";
import { Badge } from "@/components/ui/Badge";

interface SwipeableApprovalCardProps {
  children: React.ReactNode;
  onApprove: () => void;
  onReject: () => void;
  isApproving?: boolean;
  isRejecting?: boolean;
}

/**
 * Wraps any approval card content with swipe-to-approve (right)
 * and swipe-to-reject (left) gestures.
 */
export function SwipeableApprovalCard({
  children,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
}: SwipeableApprovalCardProps) {
  const swipeRef = useRef<Swipeable>(null);

  const handleSwipeRight = () => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    swipeRef.current?.close();
    onApprove();
  };

  const handleSwipeLeft = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    swipeRef.current?.close();
    onReject();
  };

  const renderLeftActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    const scale = dragX.interpolate({
      inputRange: [0, 80],
      outputRange: [0.5, 1],
      extrapolate: "clamp",
    });
    return (
      <View style={styles.swipeRight}>
        <Animated.Text style={[styles.swipeText, { transform: [{ scale }] }]}>
          Approve
        </Animated.Text>
      </View>
    );
  };

  const renderRightActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0.5],
      extrapolate: "clamp",
    });
    return (
      <View style={styles.swipeLeft}>
        <Animated.Text style={[styles.swipeTextReject, { transform: [{ scale }] }]}>
          Reject
        </Animated.Text>
      </View>
    );
  };

  return (
    <Swipeable
      ref={swipeRef}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      onSwipeableOpen={(direction) => {
        if (direction === "left") handleSwipeRight();
        else handleSwipeLeft();
      }}
      leftThreshold={80}
      rightThreshold={80}
      enabled={!isApproving && !isRejecting}
      overshootLeft={false}
      overshootRight={false}
    >
      {children}
    </Swipeable>
  );
}

// ---------------------------------------------------------------------------
// Leave Card
// ---------------------------------------------------------------------------

interface LeaveCardProps {
  id: string;
  facultyName: string;
  department: string;
  leaveType: string;
  days: number;
  startDate: string;
  endDate: string;
  reason: string;
  leaveBalance: { remaining: number; total: number };
  deptImpact: { faculty_on_leave: number };
  priority: string;
  onApprove: () => void;
  onReject: () => void;
  onPress: () => void;
  isApproving?: boolean;
}

export function LeaveCard({
  facultyName,
  department,
  leaveType,
  days,
  startDate,
  endDate,
  reason,
  leaveBalance,
  deptImpact,
  priority,
  onApprove,
  onReject,
  onPress,
  isApproving,
}: LeaveCardProps) {
  const priorityVariant =
    priority === "urgent"
      ? ("error" as const)
      : priority === "high"
        ? ("warning" as const)
        : ("outline" as const);

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  };

  const handleApprove = () => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    onApprove();
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Feather name="activity" size={20} color={colors.textMuted} />
          <Text style={styles.name} numberOfLines={1}>
            {facultyName}
          </Text>
        </View>
        <Badge label={priority} variant={priorityVariant} />
      </View>

      <Text style={styles.dept}>{department}</Text>

      <View style={styles.divider} />

      <Text style={styles.leaveInfo}>
        {capitalizeFirst(leaveType)} Leave · {days} day{days > 1 ? "s" : ""}
      </Text>
      <Text style={styles.dates}>
        {formatDate(startDate)} — {formatDate(endDate)}
      </Text>
      <Text style={styles.reason} numberOfLines={2}>
        Reason: {reason}
      </Text>

      <View style={styles.divider} />

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>
          Leave Balance: {leaveType.substring(0, 2).toUpperCase()}{" "}
          {leaveBalance.remaining}/{leaveBalance.total} remaining
        </Text>
      </View>
      {deptImpact.faculty_on_leave > 0 && (
        <Text style={[styles.metaText, { color: colors.warning }]}>
          Dept Impact: {deptImpact.faculty_on_leave} other faculty on leave
        </Text>
      )}

      <View style={styles.cardActions}>
        <Pressable
          onPress={onReject}
          style={({ pressed }) => [
            styles.actionBtn,
            styles.rejectActionBtn,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={styles.rejectActionText}>Reject</Text>
        </Pressable>
        <Pressable
          onPress={handleApprove}
          disabled={isApproving}
          style={({ pressed }) => [
            styles.actionBtn,
            styles.approveActionBtn,
            pressed && { opacity: 0.7 },
            isApproving && { opacity: 0.5 },
          ]}
        >
          <Text style={styles.approveActionText}>
            {isApproving ? "..." : "Approve"}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Certificate Card
// ---------------------------------------------------------------------------

interface CertificateCardProps {
  id: string;
  studentName: string;
  enrollmentNumber: string;
  phase: string;
  batch: string;
  certificateType: string;
  purpose: string;
  submittedAt: string;
  onApprove: () => void;
  onReject: () => void;
  onPress: () => void;
  isApproving?: boolean;
}

export function CertificateCard({
  studentName,
  enrollmentNumber,
  phase,
  batch,
  certificateType,
  purpose,
  submittedAt,
  onApprove,
  onReject,
  onPress,
  isApproving,
}: CertificateCardProps) {
  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const handleApprove = () => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    onApprove();
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Feather name="file-text" size={20} color={colors.textMuted} />
          <Text style={styles.name} numberOfLines={1}>
            {studentName} ({enrollmentNumber})
          </Text>
        </View>
      </View>

      <Text style={styles.dept}>
        {phase} · Batch {batch}
      </Text>

      <View style={styles.divider} />

      <Text style={styles.leaveInfo}>
        {capitalizeFirst(certificateType)} Certificate
      </Text>
      <Text style={styles.reason}>Purpose: {purpose}</Text>
      <Text style={styles.metaText}>Requested: {formatDate(submittedAt)}</Text>

      <View style={styles.cardActions}>
        <Pressable
          onPress={onReject}
          style={({ pressed }) => [
            styles.actionBtn,
            styles.rejectActionBtn,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={styles.rejectActionText}>Reject</Text>
        </Pressable>
        <Pressable
          onPress={handleApprove}
          disabled={isApproving}
          style={({ pressed }) => [
            styles.actionBtn,
            styles.approveActionBtn,
            pressed && { opacity: 0.7 },
            isApproving && { opacity: 0.5 },
          ]}
        >
          <Text style={styles.approveActionText}>
            {isApproving ? "..." : "Approve"}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Generic Workflow Card
// ---------------------------------------------------------------------------

interface WorkflowCardProps {
  id: string;
  title: string;
  submittedBy: string;
  department?: string;
  currentStep: string;
  priority: string;
  metadata: Record<string, unknown>;
  onApprove: () => void;
  onReject: () => void;
  onPress: () => void;
  isApproving?: boolean;
}

export function WorkflowCard({
  title,
  submittedBy,
  department,
  currentStep,
  priority,
  metadata,
  onApprove,
  onReject,
  onPress,
  isApproving,
}: WorkflowCardProps) {
  const priorityVariant =
    priority === "urgent"
      ? ("error" as const)
      : priority === "high"
        ? ("warning" as const)
        : ("outline" as const);

  const amount = metadata.amount as number | undefined;

  const handleApprove = () => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    onApprove();
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Feather name="clipboard" size={20} color={colors.textMuted} />
          <Text style={styles.name} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <Badge label={priority} variant={priorityVariant} />
      </View>

      <Text style={styles.dept}>
        By: {submittedBy}
        {department ? `, ${department}` : ""}
      </Text>

      <View style={styles.divider} />

      {metadata.item != null && (
        <Text style={styles.reason}>
          Item: {String(metadata.item)}
        </Text>
      )}
      {amount != null && (
        <Text style={styles.leaveInfo}>
          Amount: ₹{amount.toLocaleString("en-IN")}
        </Text>
      )}
      <Text style={styles.metaText}>
        Current Step: {currentStep} → YOUR TURN
      </Text>

      <View style={styles.cardActions}>
        <Pressable
          onPress={onReject}
          style={({ pressed }) => [
            styles.actionBtn,
            styles.rejectActionBtn,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={styles.rejectActionText}>Reject</Text>
        </Pressable>
        <Pressable
          onPress={handleApprove}
          disabled={isApproving}
          style={({ pressed }) => [
            styles.actionBtn,
            styles.approveActionBtn,
            pressed && { opacity: 0.7 },
            isApproving && { opacity: 0.5 },
          ]}
        >
          <Text style={styles.approveActionText}>
            {isApproving ? "..." : "Approve"}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // Swipe backgrounds
  swipeRight: {
    backgroundColor: colors.success,
    justifyContent: "center",
    alignItems: "flex-start",
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    marginVertical: 1,
    flex: 1,
  },
  swipeLeft: {
    backgroundColor: colors.error,
    justifyContent: "center",
    alignItems: "flex-end",
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    marginVertical: 1,
    flex: 1,
  },
  swipeText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: fontSize.md,
  },
  swipeTextReject: {
    color: "#fff",
    fontWeight: "700",
    fontSize: fontSize.md,
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
  name: {
    fontSize: fontSize.base,
    fontWeight: "700",
    color: colors.textPrimary,
    flex: 1,
  },
  dept: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginLeft: 28, // align with name after icon (20px icon + 8px gap)
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  leaveInfo: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  dates: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  reason: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metaText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  // Action buttons at bottom of card
  cardActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
    justifyContent: "flex-end",
  },
  actionBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    minWidth: 90,
    alignItems: "center",
  },
  rejectActionBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
  },
  rejectActionText: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.error,
  },
  approveActionBtn: {
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.25)",
  },
  approveActionText: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.success,
  },
});
