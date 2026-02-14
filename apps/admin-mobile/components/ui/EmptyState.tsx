import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors, spacing, fontSize, radius } from "@/lib/theme";

type EmptyVariant = "empty" | "success" | "error";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  variant?: EmptyVariant;
  onRetry?: () => void;
  retryLabel?: string;
}

const VARIANT_EMOJI: Record<EmptyVariant, string> = {
  empty: "📭",
  success: "✅",
  error: "⚠️",
};

const VARIANT_TITLE_COLOR: Record<EmptyVariant, string> = {
  empty: colors.textSecondary,
  success: colors.success,
  error: colors.error,
};

export function EmptyState({
  title,
  description,
  icon,
  variant = "empty",
  onRetry,
  retryLabel = "Try Again",
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      {icon ? (
        <View style={styles.iconWrap}>{icon}</View>
      ) : (
        <Text style={styles.emoji}>{VARIANT_EMOJI[variant]}</Text>
      )}
      <Text style={[styles.title, { color: VARIANT_TITLE_COLOR[variant] }]}>
        {title}
      </Text>
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
    paddingVertical: spacing["4xl"],
    paddingHorizontal: spacing.xl,
  },
  iconWrap: {
    marginBottom: spacing.lg,
    opacity: 0.5,
  },
  emoji: {
    fontSize: 40,
    marginBottom: spacing.md,
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
    backgroundColor: colors.surface,
  },
  retryText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.primary,
  },
});
