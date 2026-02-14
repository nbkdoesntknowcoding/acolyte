import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

interface StatCardProps {
  label: string;
  value: string | number;
  subLabel?: string;
  subColor?: string;
  progress?: number; // 0-100
  progressColor?: string;
  color?: string;
  onPress?: () => void;
}

export function StatCard({
  label,
  value,
  subLabel,
  subColor,
  progress,
  progressColor,
  color,
  onPress,
}: StatCardProps) {
  const content = (
    <View style={styles.container}>
      <Text style={[styles.value, color ? { color } : undefined]}>
        {value}
      </Text>
      <Text style={styles.label}>{label}</Text>
      {subLabel && (
        <Text style={[styles.sub, subColor ? { color: subColor } : undefined]}>
          {subLabel}
        </Text>
      )}
      {progress != null && (
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.min(progress, 100)}%`,
                backgroundColor: progressColor ?? colors.primary,
              },
            ]}
          />
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.wrapper,
          pressed && { opacity: 0.7 },
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={styles.wrapper}>{content}</View>;
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: "center",
    gap: spacing.xs,
  },
  value: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  label: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sub: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  progressTrack: {
    width: "100%",
    height: 3,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 2,
    marginTop: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
});
