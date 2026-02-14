import { useCallback, useMemo, useRef, useState } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import BottomSheet from "@gorhom/bottom-sheet";
import { colors, spacing, fontSize } from "@/lib/theme";
import {
  useWorkflows,
  useLeaveRequests,
  useCertificateRequests,
  useApproveWorkflow,
  useRejectWorkflow,
  useApproveLeave,
  useRejectLeave,
} from "@/lib/hooks/use-approvals";
import type {
  WorkflowInstance,
  LeaveRequest,
  CertificateRequest,
} from "@/lib/api/admin-api";
import { SegmentedControl } from "@/components/approvals/SegmentedControl";
import {
  SwipeableApprovalCard,
  LeaveCard,
  CertificateCard,
  WorkflowCard,
} from "@/components/approvals/SwipeableApprovalCard";
import { RejectBottomSheet } from "@/components/approvals/RejectBottomSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { PullRefresh } from "@/components/ui/PullRefresh";

type Tab = "all" | "leave" | "certificate" | "other";

// Unified item type for the flat list
type ApprovalItem =
  | { kind: "leave"; data: LeaveRequest }
  | { kind: "certificate"; data: CertificateRequest }
  | { kind: "workflow"; data: WorkflowInstance };

export default function ApprovalsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("all");
  const [rejectTarget, setRejectTarget] = useState<{
    id: string;
    title: string;
    kind: "leave" | "workflow";
  } | null>(null);

  const rejectSheetRef = useRef<BottomSheet>(null);

  // Data fetching
  const workflows = useWorkflows();
  const leaves = useLeaveRequests();
  const certs = useCertificateRequests();

  // Mutations
  const approveWf = useApproveWorkflow();
  const rejectWf = useRejectWorkflow();
  const approveLv = useApproveLeave();
  const rejectLv = useRejectLeave();

  // Flatten infinite query pages
  const workflowItems = useMemo(
    () => workflows.data?.pages.flatMap((p) => p.data) ?? [],
    [workflows.data],
  );
  const leaveItems = useMemo(
    () => leaves.data?.pages.flatMap((p) => p.data) ?? [],
    [leaves.data],
  );
  const certItems = useMemo(
    () => certs.data?.pages.flatMap((p) => p.data) ?? [],
    [certs.data],
  );

  // Counts
  const leaveCount = leaveItems.length;
  const certCount = certItems.length;
  const otherCount = workflowItems.filter(
    (w) => w.workflow_type !== "leave" && w.workflow_type !== "certificate",
  ).length;
  const allCount = leaveCount + certCount + otherCount;

  // Build unified list based on tab
  const items: ApprovalItem[] = useMemo(() => {
    const result: ApprovalItem[] = [];

    if (tab === "all" || tab === "leave") {
      for (const l of leaveItems) {
        result.push({ kind: "leave", data: l });
      }
    }
    if (tab === "all" || tab === "certificate") {
      for (const c of certItems) {
        result.push({ kind: "certificate", data: c });
      }
    }
    if (tab === "all" || tab === "other") {
      for (const w of workflowItems) {
        if (w.workflow_type !== "leave" && w.workflow_type !== "certificate") {
          result.push({ kind: "workflow", data: w });
        }
      }
    }

    // Sort by submitted_at desc
    result.sort((a, b) => {
      const aTime = "submitted_at" in a.data ? a.data.submitted_at : "";
      const bTime = "submitted_at" in b.data ? b.data.submitted_at : "";
      return bTime.localeCompare(aTime);
    });

    return result;
  }, [tab, leaveItems, certItems, workflowItems]);

  // Loading state
  const isLoading = workflows.isLoading || leaves.isLoading || certs.isLoading;
  const isRefreshing =
    workflows.isRefetching || leaves.isRefetching || certs.isRefetching;

  // Refresh
  const onRefresh = useCallback(() => {
    workflows.refetch();
    leaves.refetch();
    certs.refetch();
  }, [workflows, leaves, certs]);

  // Load more (infinite scroll)
  const onEndReached = useCallback(() => {
    if (tab === "leave" && leaves.hasNextPage) leaves.fetchNextPage();
    if (tab === "certificate" && certs.hasNextPage) certs.fetchNextPage();
    if ((tab === "all" || tab === "other") && workflows.hasNextPage)
      workflows.fetchNextPage();
  }, [tab, leaves, certs, workflows]);

  // Approve handlers
  const handleApprove = useCallback(
    (item: ApprovalItem) => {
      if (item.kind === "leave") {
        approveLv.mutate(item.data.id);
      } else {
        const id = item.kind === "certificate" ? item.data.id : item.data.id;
        approveWf.mutate(id);
      }
    },
    [approveLv, approveWf],
  );

  // Reject handlers (open bottom sheet)
  const handleRejectOpen = useCallback(
    (item: ApprovalItem) => {
      const id = item.data.id;
      const title =
        item.kind === "leave"
          ? `${(item.data as LeaveRequest).faculty_name}'s leave`
          : item.kind === "certificate"
            ? `${(item.data as CertificateRequest).student_name}'s certificate`
            : (item.data as WorkflowInstance).title;
      setRejectTarget({
        id,
        title,
        kind: item.kind === "leave" ? "leave" : "workflow",
      });
      rejectSheetRef.current?.snapToIndex(0);
    },
    [],
  );

  const handleRejectConfirm = useCallback(
    (reason: string) => {
      if (!rejectTarget) return;
      if (rejectTarget.kind === "leave") {
        rejectLv.mutate({ id: rejectTarget.id, reason });
      } else {
        rejectWf.mutate({ id: rejectTarget.id, reason });
      }
      rejectSheetRef.current?.close();
      setRejectTarget(null);
    },
    [rejectTarget, rejectLv, rejectWf],
  );

  // Item ID getter
  const getItemId = (item: ApprovalItem) => `${item.kind}-${item.data.id}`;

  const renderItem = useCallback(
    ({ item }: { item: ApprovalItem }) => {
      const onApprove = () => handleApprove(item);
      const onReject = () => handleRejectOpen(item);

      if (item.kind === "leave") {
        const d = item.data;
        return (
          <SwipeableApprovalCard
            onApprove={onApprove}
            onReject={onReject}
            isApproving={approveLv.isPending && approveLv.variables === d.id}
          >
            <LeaveCard
              id={d.id}
              facultyName={d.faculty_name}
              department={d.department_name}
              leaveType={d.leave_type}
              days={d.days}
              startDate={d.start_date}
              endDate={d.end_date}
              reason={d.reason}
              leaveBalance={d.leave_balance}
              deptImpact={d.dept_impact}
              priority={d.priority}
              onApprove={onApprove}
              onReject={onReject}
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/approvals/[id]",
                  params: { id: d.id, kind: "leave" },
                })
              }
              isApproving={approveLv.isPending && approveLv.variables === d.id}
            />
          </SwipeableApprovalCard>
        );
      }

      if (item.kind === "certificate") {
        const d = item.data;
        return (
          <SwipeableApprovalCard
            onApprove={onApprove}
            onReject={onReject}
            isApproving={approveWf.isPending && approveWf.variables === d.id}
          >
            <CertificateCard
              id={d.id}
              studentName={d.student_name}
              enrollmentNumber={d.enrollment_number}
              phase={d.current_phase}
              batch={d.batch}
              certificateType={d.certificate_type}
              purpose={d.purpose}
              submittedAt={d.submitted_at}
              onApprove={onApprove}
              onReject={onReject}
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/approvals/[id]",
                  params: { id: d.id, kind: "certificate" },
                })
              }
              isApproving={approveWf.isPending && approveWf.variables === d.id}
            />
          </SwipeableApprovalCard>
        );
      }

      // workflow
      const d = item.data as WorkflowInstance;
      return (
        <SwipeableApprovalCard
          onApprove={onApprove}
          onReject={onReject}
          isApproving={approveWf.isPending && approveWf.variables === d.id}
        >
          <WorkflowCard
            id={d.id}
            title={d.title}
            submittedBy={d.submitted_by}
            department={d.department_name}
            currentStep={d.current_step}
            priority={d.priority}
            metadata={d.metadata}
            onApprove={onApprove}
            onReject={onReject}
            onPress={() =>
              router.push({
                pathname: "/(tabs)/approvals/[id]",
                params: { id: d.id, kind: "workflow" },
              })
            }
            isApproving={approveWf.isPending && approveWf.variables === d.id}
          />
        </SwipeableApprovalCard>
      );
    },
    [handleApprove, handleRejectOpen, approveLv, approveWf, router],
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Approvals</Text>
        <Text style={styles.count}>{allCount} pending</Text>
      </View>

      <View style={styles.segmentWrap}>
        <SegmentedControl
          segments={[
            { key: "all", label: "All", count: allCount },
            { key: "leave", label: "Leave", count: leaveCount },
            { key: "certificate", label: "Certs", count: certCount },
            { key: "other", label: "Other", count: otherCount },
          ]}
          selectedKey={tab}
          onSelect={(k) => setTab(k as Tab)}
        />
      </View>

      {isLoading ? (
        <View style={styles.loaderWrap}>
          {[1, 2, 3].map((i) => (
            <SkeletonLoader key={i} height={160} />
          ))}
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={getItemId}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <PullRefresh refreshing={isRefreshing} onRefresh={onRefresh} />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            workflows.isFetchingNextPage ||
            leaves.isFetchingNextPage ||
            certs.isFetchingNextPage ? (
              <ActivityIndicator
                color={colors.primary}
                style={styles.footerLoader}
              />
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>🎉</Text>
              <Text style={styles.emptyTitle}>All approvals handled!</Text>
              <Text style={styles.emptyDesc}>
                Nothing needs your attention right now.
              </Text>
            </View>
          }
        />
      )}

      <RejectBottomSheet
        sheetRef={rejectSheetRef}
        title={rejectTarget?.title ?? ""}
        onReject={handleRejectConfirm}
        loading={rejectLv.isPending || rejectWf.isPending}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: {
    fontSize: fontSize["2xl"],
    fontWeight: "800",
    color: colors.textPrimary,
  },
  count: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  segmentWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  loaderWrap: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  list: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing["4xl"],
  },
  footerLoader: {
    paddingVertical: spacing.xl,
  },
  emptyWrap: {
    alignItems: "center",
    paddingVertical: spacing["4xl"],
    gap: spacing.sm,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.success,
  },
  emptyDesc: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
});
