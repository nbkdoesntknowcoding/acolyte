import { View, StyleSheet } from "react-native";
import { colors, radius } from "@/lib/theme";

interface MiniSparklineProps {
  data: number[];
  height?: number;
  barColor?: string;
}

/**
 * Lightweight sparkline bar chart — no chart library needed.
 * Renders a row of thin vertical bars proportional to max value.
 */
export function MiniSparkline({
  data,
  height = 40,
  barColor = colors.primary,
}: MiniSparklineProps) {
  const max = Math.max(...data, 1);

  return (
    <View style={[styles.container, { height }]}>
      {data.map((value, i) => {
        const barHeight = (value / max) * height;
        return (
          <View
            key={i}
            style={[
              styles.bar,
              {
                height: Math.max(barHeight, 2),
                backgroundColor: value > 0 ? barColor : colors.surfaceElevated,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
  },
  bar: {
    flex: 1,
    borderRadius: radius.sm,
    minWidth: 3,
  },
});
