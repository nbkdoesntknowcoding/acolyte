import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, fontSize, radius, typography } from "@/lib/theme";
import { useAlertCounts } from "@/lib/hooks/use-alerts";
import { Badge } from "@/components/ui/Badge";

export default function MoreScreen() {
  const router = useRouter();
  const { totalCount: alertCount } = useAlertCounts();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>More</Text>

        {/* People */}
        <Pressable
          onPress={() => router.push("/(tabs)/people")}
          style={({ pressed }) => [
            styles.card,
            pressed && { opacity: 0.7 },
          ]}
        >
          <View style={styles.cardIcon}>
            <Feather name="users" size={24} color={colors.accent} />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>People</Text>
            <Text style={styles.cardDesc}>
              Search students, faculty, and staff
            </Text>
          </View>
          <Feather name="chevron-right" size={16} color={colors.textMuted} />
        </Pressable>

        {/* Alerts */}
        <Pressable
          onPress={() => router.push("/(tabs)/alerts")}
          style={({ pressed }) => [
            styles.card,
            pressed && { opacity: 0.7 },
          ]}
        >
          <View style={styles.cardIcon}>
            <Feather name="bell" size={24} color={colors.warning} />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>Alerts & Notices</Text>
            <Text style={styles.cardDesc}>
              Compliance alerts, notices, grievances
            </Text>
          </View>
          {alertCount > 0 && (
            <Badge label={String(alertCount)} variant="error" size="sm" />
          )}
          <Feather
            name="chevron-right"
            size={16}
            color={colors.textMuted}
            style={{ marginLeft: spacing.sm }}
          />
        </Pressable>

        {/* Settings (placeholder) */}
        <Pressable
          style={({ pressed }) => [
            styles.card,
            pressed && { opacity: 0.7 },
            { opacity: 0.5 },
          ]}
          disabled
        >
          <View style={styles.cardIcon}>
            <Feather name="settings" size={24} color={colors.textMuted} />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>Settings</Text>
            <Text style={styles.cardDesc}>App preferences (coming soon)</Text>
          </View>
          <Feather name="chevron-right" size={16} color={colors.textMuted} />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  heading: {
    ...typography.display,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.text,
  },
  cardDesc: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
});
