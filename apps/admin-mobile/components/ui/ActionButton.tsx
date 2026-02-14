import { Pressable, Text, StyleSheet, ActivityIndicator } from "react-native";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

interface ActionButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "destructive" | "outline";
  loading?: boolean;
  disabled?: boolean;
}

export function ActionButton({
  label,
  onPress,
  variant = "primary",
  loading,
  disabled,
}: ActionButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variant === "primary" && styles.primary,
        variant === "destructive" && styles.destructive,
        variant === "outline" && styles.outline,
        pressed && { opacity: 0.8 },
        isDisabled && { opacity: 0.5 },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.textPrimary} />
      ) : (
        <Text
          style={[
            styles.label,
            variant === "outline" && { color: colors.textSecondary },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  destructive: {
    backgroundColor: colors.error,
  },
  outline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    fontSize: fontSize.base,
    fontWeight: "600",
    color: colors.background,
  },
});
