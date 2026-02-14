import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

interface AlertBannerProps {
  message: string;
  variant?: "warning" | "error" | "info";
  onPress?: () => void;
}

const VARIANT_COLORS = {
  warning: { bg: "rgba(245, 158, 11, 0.08)", border: "rgba(245, 158, 11, 0.25)", text: colors.warning },
  error: { bg: "rgba(239, 68, 68, 0.08)", border: "rgba(239, 68, 68, 0.25)", text: colors.error },
  info: { bg: "rgba(59, 130, 246, 0.08)", border: "rgba(59, 130, 246, 0.25)", text: colors.info },
};

export function AlertBanner({ message, variant = "warning", onPress }: AlertBannerProps) {
  const c = VARIANT_COLORS[variant];

  const inner = (
    <View style={[styles.container, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[styles.text, { color: c.text }]}>{message}</Text>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.7 }}>
        {inner}
      </Pressable>
    );
  }
  return inner;
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  text: {
    fontSize: fontSize.sm,
    fontWeight: "500",
  },
});
