import { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Linking,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import BottomSheet from "@gorhom/bottom-sheet";
import * as Haptics from "expo-haptics";
import { format, eachDayOfInterval, parseISO, isSameDay } from "date-fns";
import { colors, spacing, fontSize, radius } from "@/lib/theme";
import {
  useWorkflowDetail,
  useLeaveDetail,
  useApproveWorkflow,
  useRejectWorkflow,
  useApproveLeave,
  useRejectLeave,
} from "@/lib/hooks/use-approvals";
import { RejectBottomSheet } from "@/components/approvals/RejectBottomSheet";
import { Badge } from "@/components/ui/Badge";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";

export default function ApprovalDetailScreen() {
  const { id, kind } = useLocalSearchParams<{ id: string; kind: string }>();
  const router = useRouter();
  const rejectSheetRef = useRef<BottomSheet>(null);

  const isLeave = kind === "leave";

  // Fetch detail
  const leaveQuery = useLeaveDetail(isLeave ? id : "");
  const workflowQuery = useWorkflowDetail(!isLeave ? id : "");

  // Mutations
  const approveWf = useApproveWorkflow();
  const rejectWf = useRejectWorkflow();
  const approveLv = useApproveLeave();
  const rejectLv = useRejectLeave();

  const isLoading = isLeave ? leaveQuery.isLoading : workflowQuery.isLoading;
  const isError = isLeave ? leaveQuery.isError : workflowQuery.isError;

  const handleApprove = () => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    if (isLeave) {
      approveLv.mutate(id, { onSuccess: () => router.back() });
    } else {
      approveWf.mutate(id, { onSuccess: () => router.back() });
    }
  };

  const handleRejectConfirm = useCallback(
    (reason: string) => {
      if (isLeave) {
        rejectLv.mutate({ id, reason }, { onSuccess: () => router.back() });
      } else {
        rejectWf.mutate({ id, reason }, { onSuccess: () => router.back() });
      }
      rejectSheetRef.current?.close();
    },
    [id, isLeave, rejectLv, rejectWf, router],
  );

  const isMutating =
    approveWf.isPending || rejectWf.isPending || approveLv.isPending || rejectLv.isPending;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.loadingWrap}>
          <SkeletonLoader height={200} />
          <SkeletonLoader height={100} />
          <SkeletonLoader height={60} />
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>Failed to load approval details.</Text>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Leave Detail ──
  if (isLeave && leaveQuery.data) {
    const d = leaveQuery.data;
    const leaveDays = eachDayOfInterval({
      start: parseISO(d.start_date),
      end: parseISO(d.end_date),
    });

    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.content}>
          {/* Back button */}
          <Pressable onPress={() => router.back()} style={styles.backRow}>
            <Text style={styles.backArrow}>‹</Text>
            <Text style={styles.backLabel}>Back to Approvals</Text>
          </Pressable>

          {/* Header */}
          <View style={styles.detailHeader}>
            <Text style={styles.detailEmoji}>🏥</Text>
            <View style={styles.detailHeaderText}>
              <Text style={styles.detailName}>{d.faculty_name}</Text>
              <Text style={styles.detailDept}>
                {d.designation}, {d.department_name}
              </Text>
            </View>
            <Badge
              label={d.priority}
              variant={
                d.priority === "urgent"
                  ? "error"
                  : d.priority === "high"
                    ? "warning"
                    : "outline"
              }
              size="md"
            />
          </View>

          {/* Leave Info Card */}
          <View style={styles.infoCard}>
            <InfoRow
              label="Leave Type"
              value={`${capitalizeFirst(d.leave_type)} Leave`}
            />
            <InfoRow label="Duration" value={`${d.days} day${d.days > 1 ? "s" : ""}`} />
            <InfoRow
              label="Dates"
              value={`${format(parseISO(d.start_date), "d MMM")} — ${format(parseISO(d.end_date), "d MMM yyyy")}`}
            />
            <InfoRow label="Reason" value={d.reason} />
          </View>

          {/* Calendar visualization */}
          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>Requested Days</Text>
            <View style={styles.calendarGrid}>
              {leaveDays.map((day) => (
                <View key={day.toISOString()} style={styles.calendarDay}>
                  <Text style={styles.calendarDayName}>
                    {format(day, "EEE")}
                  </Text>
                  <View style={styles.calendarDayCircle}>
                    <Text style={styles.calendarDayNum}>
                      {format(day, "d")}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Leave Balance */}
          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>Leave Balance</Text>
            <View style={styles.balanceRow}>
              <View style={styles.balanceItem}>
                <Text style={styles.balanceValue}>
                  {d.leave_balance.remaining}
                </Text>
                <Text style={styles.balanceLabel}>Remaining</Text>
              </View>
              <View style={styles.balanceDivider} />
              <View style={styles.balanceItem}>
                <Text style={styles.balanceValue}>{d.leave_balance.used}</Text>
                <Text style={styles.balanceLabel}>Used</Text>
              </View>
              <View style={styles.balanceDivider} />
              <View style={styles.balanceItem}>
                <Text style={styles.balanceValue}>{d.leave_balance.total}</Text>
                <Text style={styles.balanceLabel}>Total</Text>
              </View>
            </View>
          </View>

          {/* Department Impact */}
          {d.dept_impact.faculty_on_leave > 0 && (
            <View style={[styles.infoCard, styles.impactCard]}>
              <Text style={styles.cardTitle}>Department Impact</Text>
              <Text style={styles.impactText}>
                {d.dept_impact.faculty_on_leave} other faculty on leave during
                this period
              </Text>
              {d.dept_impact.faculty_names.length > 0 && (
                <Text style={styles.impactNames}>
                  {d.dept_impact.faculty_names.join(", ")}
                </Text>
              )}
            </View>
          )}

          {/* Quick Actions */}
          {d.phone && (
            <Pressable
              onPress={() => Linking.openURL(`tel:${d.phone}`)}
              style={styles.quickAction}
            >
              <Text style={styles.quickActionEmoji}>📞</Text>
              <Text style={styles.quickActionText}>Call Requester</Text>
            </Pressable>
          )}

          <Pressable
            onPress={() =>
              router.push({
                pathname: "/(tabs)/people/faculty/[id]",
                params: { id: d.faculty_id },
              })
            }
            style={styles.quickAction}
          >
            <Text style={styles.quickActionEmoji}>👤</Text>
            <Text style={styles.quickActionText}>View Profile</Text>
          </Pressable>
        </ScrollView>

        {/* Sticky bottom actions */}
        <View style={styles.stickyActions}>
          <Pressable
            onPress={() => rejectSheetRef.current?.snapToIndex(0)}
            disabled={isMutating}
            style={({ pressed }) => [
              styles.stickyBtn,
              styles.stickyReject,
              pressed && { opacity: 0.7 },
              isMutating && { opacity: 0.4 },
            ]}
          >
            <Text style={styles.stickyRejectText}>Reject</Text>
          </Pressable>
          <Pressable
            onPress={handleApprove}
            disabled={isMutating}
            style={({ pressed }) => [
              styles.stickyBtn,
              styles.stickyApprove,
              pressed && { opacity: 0.7 },
              isMutating && { opacity: 0.4 },
            ]}
          >
            {approveLv.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.stickyApproveText}>Approve</Text>
            )}
          </Pressable>
        </View>

        <RejectBottomSheet
          sheetRef={rejectSheetRef}
          title={`${d.faculty_name}'s leave`}
          onReject={handleRejectConfirm}
          loading={rejectLv.isPending}
        />
      </SafeAreaView>
    );
  }

  // ── Workflow / Certificate Detail ──
  const w = workflowQuery.data;
  if (!w) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>Approval not found.</Text>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isCert = kind === "certificate" || w.workflow_type === "certificate";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Back button */}
        <Pressable onPress={() => router.back()} style={styles.backRow}>
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backLabel}>Back to Approvals</Text>
        </Pressable>

        {/* Header */}
        <View style={styles.detailHeader}>
          <Text style={styles.detailEmoji}>{isCert ? "📄" : "📋"}</Text>
          <View style={styles.detailHeaderText}>
            <Text style={styles.detailName}>{w.title}</Text>
            <Text style={styles.detailDept}>
              By: {w.submitted_by}
              {w.department_name ? `, ${w.department_name}` : ""}
            </Text>
          </View>
          <Badge
            label={w.priority}
            variant={
              w.priority === "urgent"
                ? "error"
                : w.priority === "high"
                  ? "warning"
                  : "outline"
            }
            size="md"
          />
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <InfoRow label="Type" value={capitalizeFirst(w.workflow_type)} />
          <InfoRow label="Status" value={capitalizeFirst(w.status)} />
          <InfoRow label="Current Step" value={`${w.current_step} → YOUR TURN`} />
          <InfoRow
            label="Submitted"
            value={format(new Date(w.submitted_at), "d MMM yyyy, h:mm a")}
          />
        </View>

        {/* Metadata */}
        {Object.keys(w.metadata).length > 0 && (
          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>Details</Text>
            {Object.entries(w.metadata).map(([key, val]) => (
              <InfoRow
                key={key}
                label={capitalizeFirst(key)}
                value={String(val)}
              />
            ))}
          </View>
        )}

        {/* Quick Actions */}
        {w.phone && (
          <Pressable
            onPress={() => Linking.openURL(`tel:${w.phone}`)}
            style={styles.quickAction}
          >
            <Text style={styles.quickActionEmoji}>📞</Text>
            <Text style={styles.quickActionText}>Call Requester</Text>
          </Pressable>
        )}

        {w.submitted_by_id && (
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/(tabs)/people/faculty/[id]",
                params: { id: w.submitted_by_id },
              })
            }
            style={styles.quickAction}
          >
            <Text style={styles.quickActionEmoji}>👤</Text>
            <Text style={styles.quickActionText}>View Profile</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* Sticky bottom actions */}
      <View style={styles.stickyActions}>
        <Pressable
          onPress={() => rejectSheetRef.current?.snapToIndex(0)}
          disabled={isMutating}
          style={({ pressed }) => [
            styles.stickyBtn,
            styles.stickyReject,
            pressed && { opacity: 0.7 },
            isMutating && { opacity: 0.4 },
          ]}
        >
          <Text style={styles.stickyRejectText}>Reject</Text>
        </Pressable>
        <Pressable
          onPress={handleApprove}
          disabled={isMutating}
          style={({ pressed }) => [
            styles.stickyBtn,
            styles.stickyApprove,
            pressed && { opacity: 0.7 },
            isMutating && { opacity: 0.4 },
          ]}
        >
          {approveWf.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.stickyApproveText}>Approve</Text>
          )}
        </Pressable>
      </View>

      <RejectBottomSheet
        sheetRef={rejectSheetRef}
        title={w.title}
        onReject={handleRejectConfirm}
        loading={rejectWf.isPending}
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: 100, // room for sticky actions
  },
  loadingWrap: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  errorWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
  },
  errorText: {
    fontSize: fontSize.base,
    color: colors.error,
  },
  backBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backBtnText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: "600",
  },

  // Back row
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  backArrow: {
    fontSize: fontSize["2xl"],
    color: colors.primary,
    fontWeight: "300",
  },
  backLabel: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: "600",
  },

  // Detail header
  detailHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  detailEmoji: {
    fontSize: 28,
    marginTop: 2,
  },
  detailHeaderText: {
    flex: 1,
    gap: 2,
  },
  detailName: {
    fontSize: fontSize.lg,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  detailDept: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },

  // Info card
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardTitle: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  infoLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    flex: 1,
  },
  infoValue: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    fontWeight: "500",
    flex: 2,
    textAlign: "right",
  },

  // Calendar
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  calendarDay: {
    alignItems: "center",
    gap: 4,
  },
  calendarDayName: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  calendarDayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  calendarDayNum: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.error,
  },

  // Balance
  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  balanceItem: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  balanceValue: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  balanceLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  balanceDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
  },

  // Impact
  impactCard: {
    borderColor: "rgba(245, 158, 11, 0.25)",
  },
  impactText: {
    fontSize: fontSize.sm,
    color: colors.warning,
    fontWeight: "500",
  },
  impactNames: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  // Quick actions
  quickAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  quickActionEmoji: {
    fontSize: 20,
  },
  quickActionText: {
    fontSize: fontSize.base,
    fontWeight: "600",
    color: colors.primary,
  },

  // Sticky actions
  stickyActions: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing["2xl"],
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  stickyBtn: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  stickyReject: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.30)",
  },
  stickyRejectText: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.error,
  },
  stickyApprove: {
    backgroundColor: colors.success,
  },
  stickyApproveText: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: "#fff",
  },
});
