import { Tabs } from "expo-router";
import { View, Text, StyleSheet } from "react-native";
import { colors, fontSize } from "@/lib/theme";
import { useAlertCounts } from "@/lib/hooks/use-alerts";
import { usePendingApprovals } from "@/lib/hooks/use-dashboard";

/**
 * Simple tab icon — emoji + optional badge count.
 * We use emoji instead of icon library to keep bundle small.
 */
function TabIcon({
  emoji,
  focused,
  badgeCount,
}: {
  emoji: string;
  focused: boolean;
  badgeCount?: number;
}) {
  return (
    <View style={iconStyles.wrap}>
      <Text style={[iconStyles.emoji, focused && iconStyles.focused]}>
        {emoji}
      </Text>
      {badgeCount != null && badgeCount > 0 && (
        <View style={iconStyles.badge}>
          <Text style={iconStyles.badgeText}>
            {badgeCount > 99 ? "99+" : badgeCount}
          </Text>
        </View>
      )}
    </View>
  );
}

const iconStyles = StyleSheet.create({
  wrap: { position: "relative" },
  emoji: { fontSize: 22, opacity: 0.5 },
  focused: { opacity: 1 },
  badge: {
    position: "absolute",
    top: -4,
    right: -10,
    backgroundColor: colors.error,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
  },
});

export default function TabLayout() {
  // Badge counts
  const { data: approvalsData } = usePendingApprovals(100);
  const { totalCount: alertCount } = useAlertCounts();
  const approvalCount = approvalsData?.data?.length ?? 0;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBarBg,
          borderTopColor: colors.tabBarBorder,
          borderTopWidth: 1,
          height: 80,
          paddingBottom: 20,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarLabelStyle: {
          fontSize: fontSize.xs,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="📊" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="approvals"
        options={{
          title: "Approvals",
          tabBarIcon: ({ focused }) => (
            <TabIcon
              emoji="✅"
              focused={focused}
              badgeCount={approvalCount}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="campus"
        options={{
          title: "Campus",
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="📡" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="people"
        options={{
          title: "People",
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="👥" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: "Alerts",
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🔔" focused={focused} badgeCount={alertCount} />
          ),
        }}
      />
    </Tabs>
  );
}
