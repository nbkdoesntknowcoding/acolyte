import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors, radius, spacing, fontSize } from "@/lib/theme";
import { MiniSparkline } from "./MiniSparkline";

interface PulseItem {
  label: string;
  value: number;
  emoji: string;
}

interface CampusPulseCardProps {
  items: PulseItem[];
  hourlyData?: number[];
  onPress?: () => void;
}

export function CampusPulseCard({
  items,
  hourlyData,
  onPress,
}: CampusPulseCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        pressed && onPress && { opacity: 0.8 },
      ]}
    >
      <Text style={styles.title}>Campus Today</Text>
      <View style={styles.row}>
        {items.map((item) => (
          <Text key={item.label} style={styles.stat}>
            {item.emoji} <Text style={styles.statValue}>{item.value}</Text>{" "}
            <Text style={styles.statLabel}>{item.label}</Text>
          </Text>
        ))}
      </View>
      {hourlyData && hourlyData.length > 0 && (
        <View style={styles.sparklineWrap}>
          <MiniSparkline data={hourlyData} height={36} />
          <Text style={styles.sparklineLabel}>Scan volume by hour</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.textPrimary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  stat: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  statValue: {
    fontWeight: "700",
    color: colors.textPrimary,
  },
  statLabel: {
    color: colors.textMuted,
  },
  sparklineWrap: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  sparklineLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: "center",
  },
});
