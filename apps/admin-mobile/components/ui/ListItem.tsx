import { View, Text, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, fontSize, radius } from "@/lib/theme";
import type { ReactNode } from "react";

interface ListItemProps {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
  showSeparator?: boolean;
}

export function ListItem({
  title,
  subtitle,
  left,
  right,
  onPress,
  showChevron = true,
  showSeparator = true,
}: ListItemProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.container,
        showSeparator && styles.separator,
        pressed && onPress ? { opacity: 0.7 } : undefined,
      ]}
    >
      {left && <View style={styles.left}>{left}</View>}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {right && <View style={styles.right}>{right}</View>}
      {onPress && showChevron && (
        <Feather
          name="chevron-right"
          size={16}
          color={colors.textMuted}
          style={styles.chevron}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 56,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  separator: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  left: {
    marginRight: spacing.md,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: fontSize.base,
    fontWeight: "500",
    color: colors.text,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  right: {
    marginLeft: spacing.sm,
  },
  chevron: {
    marginLeft: spacing.xs,
  },
});
