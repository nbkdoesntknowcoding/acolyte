import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { format } from "date-fns";
import { colors, spacing, fontSize, radius } from "@/lib/theme";
import { useGrievance, useUpdateGrievance } from "@/lib/hooks/use-alerts";
import { Badge } from "@/components/ui/Badge";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";

const STATUSES = [
  { key: "under_review", label: "Under Review" },
  { key: "in_progress", label: "In Progress" },
  { key: "resolved", label: "Resolved" },
  { key: "closed", label: "Closed" },
] as const;

export default function GrievanceUpdateModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: grievance, isLoading } = useGrievance(id ?? "");
  const updateMutation = useUpdateGrievance();

  const [newStatus, setNewStatus] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const canUpdate = newStatus !== null;

  const handleUpdate = () => {
    if (!canUpdate || !id) return;

    updateMutation.mutate(
      { id, status: newStatus, notes: notes.trim() || undefined },
      {
        onSuccess: () => {
          if (Platform.OS !== "web") {
            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success,
            );
          }
          Alert.alert("Updated", "Grievance status has been updated.", [
            { text: "OK", onPress: () => router.back() },
          ]);
        },
        onError: () => {
          Alert.alert("Error", "Failed to update grievance. Please try again.");
        },
      },
    );
  };

  const priorityVariant =
    grievance?.priority === "urgent" || grievance?.priority === "high"
      ? ("error" as const)
      : grievance?.priority === "medium"
        ? ("warning" as const)
        : ("outline" as const);

  const currentStatusVariant =
    grievance?.status === "open"
      ? ("error" as const)
      : grievance?.status === "in_progress"
        ? ("warning" as const)
        : grievance?.status === "resolved"
          ? ("success" as const)
          : ("outline" as const);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Update Grievance</Text>
          <Pressable
            onPress={handleUpdate}
            disabled={!canUpdate || updateMutation.isPending}
            style={({ pressed }) => [
              styles.updateBtn,
              pressed && { opacity: 0.7 },
              (!canUpdate || updateMutation.isPending) && { opacity: 0.4 },
            ]}
          >
            {updateMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.background} />
            ) : (
              <Text style={styles.updateText}>Update</Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {isLoading ? (
            <View style={styles.skeletonWrap}>
              <SkeletonLoader height={120} />
              <SkeletonLoader height={80} />
            </View>
          ) : grievance ? (
            <>
              {/* Grievance Info */}
              <View style={styles.infoCard}>
                <View style={styles.infoHeader}>
                  <Text style={styles.ticketNumber}>
                    {grievance.ticket_number}
                  </Text>
                  <Badge
                    label={grievance.priority}
                    variant={priorityVariant}
                    size="md"
                  />
                </View>

                <InfoRow label="Category" value={grievance.category} />
                <InfoRow label="Filed By" value={grievance.filed_by} />
                <InfoRow
                  label="Filed"
                  value={format(
                    new Date(grievance.filed_at),
                    "d MMM yyyy, h:mm a",
                  )}
                />

                <View style={styles.descriptionWrap}>
                  <Text style={styles.descriptionLabel}>Description</Text>
                  <Text style={styles.descriptionText}>
                    {grievance.description}
                  </Text>
                </View>

                <View style={styles.currentStatus}>
                  <Text style={styles.currentStatusLabel}>Current Status</Text>
                  <Badge
                    label={grievance.status.replace(/_/g, " ")}
                    variant={currentStatusVariant}
                    size="md"
                  />
                </View>
              </View>

              {/* Status Update */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Update Status To</Text>
                <View style={styles.statusGrid}>
                  {STATUSES.map((s) => {
                    const active = newStatus === s.key;
                    return (
                      <Pressable
                        key={s.key}
                        onPress={() => setNewStatus(s.key)}
                        style={[styles.statusChip, active && styles.statusChipActive]}
                      >
                        <Text
                          style={[
                            styles.statusText,
                            active && styles.statusTextActive,
                          ]}
                        >
                          {s.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Notes */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>
                  Notes (what action was taken)
                </Text>
                <TextInput
                  style={[styles.input, styles.textarea]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Describe the action taken..."
                  placeholderTextColor={colors.textPlaceholder}
                  multiline
                  textAlignVertical="top"
                />
              </View>
            </>
          ) : (
            <Text style={styles.errorText}>Grievance not found.</Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cancelText: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  headerTitle: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  updateBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minWidth: 80,
    alignItems: "center",
  },
  updateText: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.xl,
    paddingBottom: spacing["4xl"],
  },
  skeletonWrap: {
    gap: spacing.lg,
  },
  errorText: {
    fontSize: fontSize.base,
    color: colors.error,
    textAlign: "center",
    paddingVertical: spacing["4xl"],
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
  infoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  ticketNumber: {
    fontSize: fontSize.lg,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  infoLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  infoValue: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    fontWeight: "500",
    textTransform: "capitalize",
  },
  descriptionWrap: {
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  descriptionLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  descriptionText: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  currentStatus: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  currentStatusLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },

  // Fields
  field: {
    gap: spacing.sm,
  },
  fieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },
  textarea: {
    minHeight: 120,
    paddingTop: spacing.md,
  },

  // Status chips
  statusGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  statusChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  statusChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryDim,
  },
  statusText: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: colors.textSecondary,
  },
  statusTextActive: {
    color: colors.primary,
    fontWeight: "700",
  },
});
