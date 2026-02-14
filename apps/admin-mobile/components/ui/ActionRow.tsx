import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { colors, spacing, fontSize, radius } from "@/lib/theme";

interface ActionButton {
  label: string;
  variant: "primary" | "danger" | "ghost";
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}

interface ActionRowProps {
  actions: ActionButton[];
}

export function ActionRow({ actions }: ActionRowProps) {
  return (
    <View style={styles.row}>
      {actions.map((action) => {
        const btnStyle =
          action.variant === "primary"
            ? styles.primary
            : action.variant === "danger"
              ? styles.danger
              : styles.ghost;
        const textStyle =
          action.variant === "primary"
            ? styles.primaryText
            : action.variant === "danger"
              ? styles.dangerText
              : styles.ghostText;
        const busy = action.loading || action.disabled;

        return (
          <Pressable
            key={action.label}
            onPress={action.onPress}
            disabled={busy}
            style={({ pressed }) => [
              styles.btn,
              btnStyle,
              pressed && { opacity: 0.7 },
              busy && { opacity: 0.4 },
            ]}
          >
            {action.loading ? (
              <ActivityIndicator
                size="small"
                color={action.variant === "primary" ? "#fff" : colors.text}
              />
            ) : (
              <Text style={textStyle}>{action.label}</Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "flex-end",
  },
  btn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: {
    backgroundColor: colors.accent,
  },
  primaryText: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: "#fff",
  },
  danger: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
  },
  dangerText: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.error,
  },
  ghost: {
    backgroundColor: "transparent",
  },
  ghostText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.textSecondary,
  },
});
