import { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import BottomSheet, { BottomSheetBackdrop } from "@gorhom/bottom-sheet";
import type { BottomSheetDefaultBackdropProps } from "@gorhom/bottom-sheet/lib/typescript/components/bottomSheetBackdrop/types";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

interface RejectBottomSheetProps {
  sheetRef: React.RefObject<BottomSheet | null>;
  title: string;
  onReject: (reason: string) => void;
  loading?: boolean;
}

export function RejectBottomSheet({
  sheetRef,
  title,
  onReject,
  loading,
}: RejectBottomSheetProps) {
  const [reason, setReason] = useState("");
  const snapPoints = useMemo(() => ["45%"], []);

  const handleReject = () => {
    if (reason.trim().length === 0) return;
    onReject(reason.trim());
    setReason("");
  };

  const handleClose = () => {
    sheetRef.current?.close();
    setReason("");
  };

  const renderBackdrop = useCallback(
    (props: BottomSheetDefaultBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.6}
      />
    ),
    [],
  );

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handle}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.content}
      >
        <Text style={styles.title}>Reject: {title}</Text>

        <View style={styles.inputWrap}>
          <Text style={styles.label}>Reason (required)</Text>
          <TextInput
            style={styles.input}
            value={reason}
            onChangeText={setReason}
            placeholder="Enter reason for rejection..."
            placeholderTextColor={colors.textPlaceholder}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            autoFocus
          />
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={handleClose}
            style={({ pressed }) => [
              styles.btn,
              styles.cancelBtn,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleReject}
            disabled={reason.trim().length === 0 || loading}
            style={({ pressed }) => [
              styles.btn,
              styles.rejectBtn,
              pressed && { opacity: 0.7 },
              (reason.trim().length === 0 || loading) && { opacity: 0.4 },
            ]}
          >
            <Text style={styles.rejectText}>
              {loading ? "Rejecting..." : "Reject"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  handle: {
    backgroundColor: colors.textMuted,
    width: 40,
  },
  content: {
    flex: 1,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  inputWrap: {
    gap: spacing.xs,
  },
  label: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    color: colors.textPrimary,
    fontSize: fontSize.base,
    minHeight: 100,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.md,
  },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtn: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelText: {
    fontSize: fontSize.base,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  rejectBtn: {
    backgroundColor: colors.error,
  },
  rejectText: {
    fontSize: fontSize.base,
    fontWeight: "600",
    color: "#fff",
  },
});
