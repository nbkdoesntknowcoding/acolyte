import { View, Text, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, fontSize, radius } from "@/lib/theme";
import type { ReactNode } from "react";
import type { FeatherName } from "./Icon";

type EmptyVariant = "empty" | "success" | "error";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  iconName?: FeatherName;
  variant?: EmptyVariant;
  onRetry?: () => void;
  retryLabel?: string;
}

const VARIANT_ICON: Record<EmptyVariant, FeatherName> = {
  empty: "inbox",
  success: "check-circle",
  error: "alert-triangle",
};

const VARIANT_COLOR: Record<EmptyVariant, string> = {
  empty: colors.textMuted,
  success: colors.success,
  error: colors.error,
};

export function EmptyState({
  title,
  description,
  icon,
  iconName,
  variant = "empty",
  onRetry,
  retryLabel = "Try Again",
}: EmptyStateProps) {
  const featherIcon = iconName ?? VARIANT_ICON[variant];
  const iconColor = VARIANT_COLOR[variant];

  return (
    <View style={styles.container}>
      {icon ? (
        <View style={styles.iconWrap}>{icon}</View>
      ) : (
        <Feather
          name={featherIcon}
          size={40}
          color={iconColor}
          style={styles.featherIcon}
        />
      )}
      <Text style={[styles.title, { color: iconColor }]}>{title}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
      {onRetry && (
        <Pressable
          onPress={onRetry}
          style={({ pressed }) => [
            styles.retryBtn,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={styles.retryText}>{retryLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    paddingHorizontal: spacing.xl,
  },
  iconWrap: {
    marginBottom: spacing.lg,
    opacity: 0.5,
  },
  featherIcon: {
    marginBottom: spacing.md,
    opacity: 0.6,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.textSecondary,
    textAlign: "center",
  },
  description: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  retryText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.accent,
  },
});
