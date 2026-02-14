import { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { colors } from "@/lib/theme";

interface TimerRingProps {
  secondsLeft: number;
  maxSeconds: number;
  size?: number;
  strokeWidth?: number;
}

export function TimerRing({
  secondsLeft,
  maxSeconds,
  size = 300,
  strokeWidth = 2,
}: TimerRingProps) {
  const center = size / 2;
  const r = center - strokeWidth;
  const circumference = 2 * Math.PI * r;

  const progress = maxSeconds > 0 ? secondsLeft / maxSeconds : 0;
  const strokeDashoffset = circumference * (1 - progress);

  const strokeColor = useMemo(() => {
    if (secondsLeft <= 15) return colors.error;
    if (secondsLeft <= 60) return colors.warning;
    return colors.accent;
  }, [secondsLeft]);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Track */}
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke={colors.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress arc */}
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${center}, ${center}`}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
});
