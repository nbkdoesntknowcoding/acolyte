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
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { colors, spacing, fontSize, radius } from "@/lib/theme";
import { usePublishNotice } from "@/lib/hooks/use-alerts";

const PRIORITIES = [
  { key: "normal", label: "Normal" },
  { key: "important", label: "Important" },
  { key: "urgent", label: "Urgent" },
] as const;

const AUDIENCES = [
  { key: "all", label: "All" },
  { key: "students", label: "Students" },
  { key: "faculty", label: "Faculty" },
  { key: "staff", label: "Staff" },
] as const;

export default function NoticeComposeModal() {
  const router = useRouter();
  const publishMutation = usePublishNotice();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState("normal");
  const [audiences, setAudiences] = useState<string[]>(["all"]);

  const toggleAudience = (key: string) => {
    if (key === "all") {
      setAudiences(["all"]);
      return;
    }
    const without = audiences.filter((a) => a !== "all" && a !== key);
    if (audiences.includes(key)) {
      setAudiences(without.length === 0 ? ["all"] : without);
    } else {
      setAudiences([...without, key]);
    }
  };

  const canPublish = title.trim().length > 0 && body.trim().length > 0;

  const handlePublish = () => {
    if (!canPublish) return;

    publishMutation.mutate(
      {
        title: title.trim(),
        body: body.trim(),
        priority,
        target_audience: audiences.join(","),
      },
      {
        onSuccess: () => {
          if (Platform.OS !== "web") {
            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success,
            );
          }
          Alert.alert("Published", "Notice has been published.", [
            { text: "OK", onPress: () => router.back() },
          ]);
        },
        onError: () => {
          Alert.alert("Error", "Failed to publish notice. Please try again.");
        },
      },
    );
  };

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
          <Text style={styles.headerTitle}>Compose Notice</Text>
          <Pressable
            onPress={handlePublish}
            disabled={!canPublish || publishMutation.isPending}
            style={({ pressed }) => [
              styles.publishBtn,
              pressed && { opacity: 0.7 },
              (!canPublish || publishMutation.isPending) && { opacity: 0.4 },
            ]}
          >
            {publishMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.background} />
            ) : (
              <Text style={styles.publishText}>Publish</Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Title</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Notice title..."
              placeholderTextColor={colors.textPlaceholder}
              autoFocus
            />
          </View>

          {/* Content */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Content</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={body}
              onChangeText={setBody}
              placeholder="Write your notice here..."
              placeholderTextColor={colors.textPlaceholder}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Priority */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Priority</Text>
            <View style={styles.chipRow}>
              {PRIORITIES.map((p) => {
                const active = priority === p.key;
                return (
                  <Pressable
                    key={p.key}
                    onPress={() => setPriority(p.key)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        active && styles.chipTextActive,
                      ]}
                    >
                      {p.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Target Audience */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Target Audience</Text>
            <View style={styles.chipRow}>
              {AUDIENCES.map((a) => {
                const active = audiences.includes(a.key);
                return (
                  <Pressable
                    key={a.key}
                    onPress={() => toggleAudience(a.key)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        active && styles.chipTextActive,
                      ]}
                    >
                      {a.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  publishBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minWidth: 80,
    alignItems: "center",
  },
  publishText: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.xl,
    paddingBottom: spacing["4xl"],
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
    minHeight: 160,
    paddingTop: spacing.md,
  },

  // Chips
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryDim,
  },
  chipText: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.primary,
    fontWeight: "700",
  },
});
