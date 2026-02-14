import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors, radius, spacing, fontSize } from "@/lib/theme";
import { Badge } from "@/components/ui/Badge";

interface PersonListItemProps {
  name: string;
  subtitle: string;
  status: string;
  type: "student" | "faculty";
  onPress: () => void;
}

export function PersonListItem({
  name,
  subtitle,
  status,
  type,
  onPress,
}: PersonListItemProps) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const avatarColor = type === "student" ? colors.info : colors.primary;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.container, pressed && { opacity: 0.7 }]}
    >
      <View style={[styles.avatar, { backgroundColor: avatarColor + "20" }]}>
        <Text style={[styles.initials, { color: avatarColor }]}>{initials}</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Badge
        label={status}
        variant={status === "active" ? "success" : "outline"}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    fontSize: fontSize.base,
    fontWeight: "700",
  },
  content: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: fontSize.base,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
});
