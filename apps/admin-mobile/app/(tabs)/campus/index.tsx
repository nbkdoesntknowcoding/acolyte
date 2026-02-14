import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, fontSize, radius } from "@/lib/theme";
import { LiveFeedView } from "@/components/campus/LiveFeedView";
import { DevicesView } from "@/components/campus/DevicesView";
import { QRPointsView } from "@/components/campus/QRPointsView";

type SubView = "feed" | "devices" | "points";

const TABS: { key: SubView; label: string }[] = [
  { key: "feed", label: "Live Feed" },
  { key: "devices", label: "Devices" },
  { key: "points", label: "QR Points" },
];

export default function CampusScreen() {
  const [view, setView] = useState<SubView>("feed");

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Campus</Text>
      </View>

      {/* Segment control */}
      <View style={styles.segmentWrap}>
        <View style={styles.segmentRow}>
          {TABS.map((tab) => {
            const active = view === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setView(tab.key)}
                style={[styles.segmentPill, active && styles.segmentActive]}
              >
                <Text
                  style={[styles.segmentText, active && styles.segmentTextActive]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Sub-view */}
      <View style={styles.body}>
        {view === "feed" && <LiveFeedView />}
        {view === "devices" && <DevicesView />}
        {view === "points" && <QRPointsView />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: {
    fontSize: fontSize["2xl"],
    fontWeight: "800",
    color: colors.textPrimary,
  },
  segmentWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  segmentRow: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 3,
    gap: 3,
  },
  segmentPill: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: "center",
    borderRadius: radius.md,
  },
  segmentActive: {
    backgroundColor: colors.primaryDim,
  },
  segmentText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.textMuted,
  },
  segmentTextActive: {
    color: colors.primary,
  },
  body: {
    flex: 1,
  },
});
