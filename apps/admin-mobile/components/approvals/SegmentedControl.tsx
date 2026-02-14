import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

interface Segment {
  key: string;
  label: string;
  count: number;
}

interface SegmentedControlProps {
  segments: Segment[];
  selectedKey: string;
  onSelect: (key: string) => void;
}

export function SegmentedControl({
  segments,
  selectedKey,
  onSelect,
}: SegmentedControlProps) {
  return (
    <View style={styles.container}>
      {segments.map((seg) => {
        const active = seg.key === selectedKey;
        return (
          <Pressable
            key={seg.key}
            onPress={() => onSelect(seg.key)}
            style={[styles.pill, active && styles.pillActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {seg.label}
            </Text>
            <View style={[styles.countBadge, active && styles.countBadgeActive]}>
              <Text style={[styles.countText, active && styles.countTextActive]}>
                {seg.count}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 3,
    gap: 3,
  },
  pill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    gap: 4,
  },
  pillActive: {
    backgroundColor: colors.primaryDim,
  },
  label: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: colors.textMuted,
  },
  labelActive: {
    color: colors.primary,
  },
  countBadge: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.full,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  countBadgeActive: {
    backgroundColor: "rgba(0, 255, 136, 0.20)",
  },
  countText: {
    fontSize: 9,
    fontWeight: "700",
    color: colors.textMuted,
  },
  countTextActive: {
    color: colors.primary,
  },
});
