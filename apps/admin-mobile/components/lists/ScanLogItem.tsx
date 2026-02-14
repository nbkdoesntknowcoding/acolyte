import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, fontSize } from "@/lib/theme";
import { format } from "date-fns";

interface ScanLogItemProps {
  actionType: string;
  validationResult: string;
  rejectionReason?: string;
  userId: string;
  userName?: string;
  actionPointName?: string;
  geoValidated?: boolean;
  deviceValidated?: boolean;
  deviceModel?: string;
  qrMode?: string;
  scannedAt: string;
}

const ACTION_ICON: Record<string, string> = {
  mess_entry: "coffee",
  library_checkout: "book-open",
  library_return: "book",
  attendance_mark: "check-square",
  hostel_checkin: "home",
  lab_access: "activity",
  exam_hall_entry: "edit-3",
  parking_entry: "square",
  event_checkin: "calendar",
};

export function ScanLogItem({
  actionType,
  validationResult,
  rejectionReason,
  userId,
  userName,
  actionPointName,
  geoValidated,
  deviceValidated,
  deviceModel,
  qrMode,
  scannedAt,
}: ScanLogItemProps) {
  const [expanded, setExpanded] = useState(false);

  const isSuccess = validationResult === "success";
  const isDuplicate =
    rejectionReason?.includes("duplicate") ||
    rejectionReason?.includes("already");
  const isFail = !isSuccess;

  const borderColor = isSuccess
    ? colors.success
    : isDuplicate
      ? colors.textMuted
      : colors.error;

  const statusIconName = isSuccess ? "check-circle" : isDuplicate ? "alert-triangle" : "x-circle";
  const statusIconColor = isSuccess ? colors.success : isDuplicate ? colors.warning : colors.error;
  const actionIconName = ACTION_ICON[actionType] ?? "file";
  const label = actionType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const time = format(new Date(scannedAt), "h:mm a");
  const displayName = userName ?? userId.slice(0, 16);

  return (
    <Pressable onPress={() => setExpanded(!expanded)} style={styles.outer}>
      <View style={[styles.container, { borderLeftColor: borderColor }]}>
        <View style={styles.topRow}>
          <Feather name={statusIconName as any} size={14} color={statusIconColor} />
          <Text style={styles.time}>{time}</Text>
          <Text style={styles.userName} numberOfLines={1}>
            {displayName}
          </Text>
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.actionLineWrap}>
            <Feather name={actionIconName as any} size={14} color={colors.textMuted} />
            <Text style={styles.actionLine}>
              {label}
              {actionPointName ? ` — ${actionPointName}` : ""}
            </Text>
          </View>
          {geoValidated && (
            <Feather name="map-pin" size={12} color={colors.accent} />
          )}
        </View>

        {isFail && rejectionReason && (
          <Text style={styles.reason}>Reason: {rejectionReason}</Text>
        )}

        {expanded && (
          <View style={styles.detail}>
            <View style={styles.detailDivider} />
            <DetailRow label="User ID" value={userId} />
            {deviceModel != null && (
              <DetailRow label="Device" value={deviceModel} />
            )}
            {qrMode != null && (
              <DetailRow label="QR Mode" value={qrMode.replace(/_/g, " ")} />
            )}
            <DetailRow
              label="GPS Verified"
              value={geoValidated ? "Yes" : "No"}
            />
            <DetailRow
              label="Device Verified"
              value={deviceValidated ? "Yes" : "No"}
            />
          </View>
        )}
      </View>
    </Pressable>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    paddingHorizontal: spacing.lg,
  },
  container: {
    paddingVertical: spacing.md,
    paddingLeft: spacing.md,
    borderLeftWidth: 3,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 4,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  time: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.textSecondary,
    minWidth: 65,
  },
  userName: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 22,
  },
  actionLineWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  actionLine: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    flex: 1,
  },
  reason: {
    fontSize: fontSize.xs,
    color: colors.error,
    paddingLeft: 22,
    fontStyle: "italic",
  },
  detail: {
    paddingLeft: 22,
    gap: spacing.xs,
  },
  detailDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  detailLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  detailValue: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontWeight: "500",
  },
});
