import { Text, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

interface AlertItemProps {
  icon: React.ComponentProps<typeof Feather>["name"];
  message: string;
  variant: "error" | "warning";
  onPress?: () => void;
}

const VARIANT_STYLES = {
  error: {
    bg: "rgba(239, 68, 68, 0.08)",
    border: "rgba(239, 68, 68, 0.20)",
    text: colors.error,
  },
  warning: {
    bg: "rgba(245, 158, 11, 0.08)",
    border: "rgba(245, 158, 11, 0.20)",
    text: colors.warning,
  },
};

export function AlertItem({ icon, message, variant, onPress }: AlertItemProps) {
  const v = VARIANT_STYLES[variant];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        { backgroundColor: v.bg, borderColor: v.border },
        pressed && onPress && { opacity: 0.7 },
      ]}
    >
      <Feather name={icon} size={16} color={v.text} />
      <Text style={[styles.text, { color: v.text }]}>{message}</Text>
      {onPress && <Feather name="chevron-right" size={18} color={colors.textMuted} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  text: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: "500",
  },
});
