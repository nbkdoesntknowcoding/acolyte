import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors, spacing, typography } from "@/lib/theme";

interface SectionHeaderProps {
  title: string;
  action?: { label: string; onPress: () => void };
}

export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {action && (
        <Pressable
          onPress={action.onPress}
          hitSlop={8}
          style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}
        >
          <Text style={styles.action}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    ...typography.small,
    color: colors.textMuted,
  },
  action: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.accent,
  },
});
