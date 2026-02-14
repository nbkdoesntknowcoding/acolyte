import { View, Text, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, radius, spacing, fontSize } from "@/lib/theme";
import type { ReactNode } from "react";
import type { FeatherName } from "./Icon";

interface StatCardProps {
  label: string;
  value: string | number;
  subLabel?: string;
  subColor?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  icon?: ReactNode;
  progress?: number;
  progressColor?: string;
  color?: string;
  onPress?: () => void;
}

export function StatCard({
  label,
  value,
  subLabel,
  subColor,
  trend,
  trendValue,
  icon,
  progress,
  progressColor,
  color,
  onPress,
}: StatCardProps) {
  const content = (
    <View style={styles.container}>
      <View style={styles.topRow}>
        {icon && <View style={styles.iconWrap}>{icon}</View>}
        {trend && trendValue && (
          <View
            style={[
              styles.trendBadge,
              {
                backgroundColor:
                  trend === "up"
                    ? "rgba(16, 185, 129, 0.10)"
                    : trend === "down"
                      ? "rgba(239, 68, 68, 0.10)"
                      : "rgba(102, 102, 102, 0.10)",
              },
            ]}
          >
            <Feather
              name={trend === "up" ? "trending-up" : trend === "down" ? "trending-down" : "minus"}
              size={10}
              color={
                trend === "up"
                  ? colors.success
                  : trend === "down"
                    ? colors.error
                    : colors.textMuted
              }
            />
            <Text
              style={[
                styles.trendText,
                {
                  color:
                    trend === "up"
                      ? colors.success
                      : trend === "down"
                        ? colors.error
                        : colors.textMuted,
                },
              ]}
            >
              {trendValue}
            </Text>
          </View>
        )}
      </View>
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
                backgroundColor: progressColor ?? colors.accent,
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
        style={({ pressed }) => [styles.wrapper, pressed && { opacity: 0.7 }]}
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
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  iconWrap: {
    opacity: 0.6,
  },
  trendBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  trendText: {
    fontSize: 10,
    fontWeight: "600",
  },
  value: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: colors.text,
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
    backgroundColor: colors.cardHover,
    borderRadius: 2,
    marginTop: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
});
