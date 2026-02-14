import { View, Text, StyleSheet, Pressable } from "react-native";
import { Tabs } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { colors, fontSize } from "@/lib/theme";
import { useAlertCounts } from "@/lib/hooks/use-alerts";
import { usePendingApprovals } from "@/lib/hooks/use-dashboard";

function TabIcon({
  name,
  focused,
  badgeCount,
}: {
  name: React.ComponentProps<typeof Feather>["name"];
  focused: boolean;
  badgeCount?: number;
}) {
  return (
    <View style={iconStyles.wrap}>
      <Feather
        name={name}
        size={22}
        color={focused ? colors.tabActive : colors.tabInactive}
      />
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

function QRTabButton({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        qrStyles.container,
        pressed && { opacity: 0.8 },
      ]}
    >
      <View style={qrStyles.button}>
        <Ionicons name="qr-code-outline" size={26} color={colors.accent} />
      </View>
    </Pressable>
  );
}

const iconStyles = StyleSheet.create({
  wrap: { position: "relative" },
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

const qrStyles = StyleSheet.create({
  container: {
    top: -12,
    alignItems: "center",
    justifyContent: "center",
  },
  button: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.bg,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default function TabLayout() {
  const { data: approvalsData } = usePendingApprovals(100);
  const { totalCount: alertCount } = useAlertCounts();
  const approvalCount = approvalsData?.data?.length ?? 0;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBarBg,
          borderTopWidth: 0,
          height: 80,
          paddingBottom: 20,
          paddingTop: 8,
          elevation: 8,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
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
            <TabIcon name="bar-chart-2" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="approvals"
        options={{
          title: "Approvals",
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name="check-square"
              focused={focused}
              badgeCount={approvalCount}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="qr"
        options={{
          title: "",
          tabBarIcon: () => null,
          tabBarButton: (props) => (
            <QRTabButton onPress={props.onPress as () => void} />
          ),
        }}
      />
      <Tabs.Screen
        name="campus"
        options={{
          title: "Campus",
          tabBarIcon: ({ focused }) => (
            <TabIcon name="radio" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ focused }) => (
            <TabIcon name="menu" focused={focused} badgeCount={alertCount} />
          ),
        }}
      />
      {/* Hidden — accessed via More screen */}
      <Tabs.Screen name="people" options={{ href: null }} />
      <Tabs.Screen name="alerts" options={{ href: null }} />
    </Tabs>
  );
}
