import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fontSize, spacing } from "@/lib/theme";
import QRScreen from "./index";
import ScanScreen from "./scan";

export default function QRLayout() {
  const [activeTab, setActiveTab] = useState<"qr" | "scan">("qr");

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Top tab bar */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tab, activeTab === "qr" && styles.tabActive]}
          onPress={() => setActiveTab("qr")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "qr" && styles.tabTextActive,
            ]}
          >
            My QR
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "scan" && styles.tabActive]}
          onPress={() => setActiveTab("scan")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "scan" && styles.tabTextActive,
            ]}
          >
            Scan
          </Text>
        </Pressable>
      </View>

      {/* Content */}
      {activeTab === "qr" ? <QRScreen /> : <ScanScreen />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: colors.accent,
  },
  tabText: {
    fontSize: fontSize.base,
    fontWeight: "600",
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.accent,
  },
});
