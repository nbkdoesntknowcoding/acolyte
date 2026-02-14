import { View, Text, StyleSheet } from "react-native";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "neutral"
  | "accent"
  | "outline";

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: "sm" | "md";
}

const variantStyles: Record<
  BadgeVariant,
  { bg: string; text: string; border?: string }
> = {
  default: { bg: "rgba(16, 185, 129, 0.10)", text: colors.accent },
  accent: { bg: "rgba(16, 185, 129, 0.10)", text: colors.accent },
  success: { bg: "rgba(16, 185, 129, 0.10)", text: colors.success },
  warning: { bg: "rgba(245, 158, 11, 0.10)", text: colors.warning },
  error: { bg: "rgba(239, 68, 68, 0.10)", text: colors.error },
  info: { bg: "rgba(59, 130, 246, 0.10)", text: colors.info },
  neutral: { bg: "rgba(102, 102, 102, 0.10)", text: colors.textSecondary },
  outline: {
    bg: "transparent",
    text: colors.textSecondary,
    border: colors.border,
  },
};

export function Badge({
  label,
  variant = "default",
  size = "sm",
}: BadgeProps) {
  const v = variantStyles[variant];
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: v.bg },
        v.border ? { borderWidth: 1, borderColor: v.border } : undefined,
        size === "md" ? styles.md : undefined,
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: v.text },
          size === "md" ? styles.mdText : undefined,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: fontSize.xs,
    fontWeight: "600",
  },
  md: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  mdText: {
    fontSize: fontSize.sm,
  },
});
