import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  debounceMs?: number;
  loading?: boolean;
  autoFocus?: boolean;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = "Search...",
  debounceMs = 300,
  loading,
  autoFocus,
}: SearchBarProps) {
  const [local, setLocal] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  const handleChange = useCallback(
    (text: string) => {
      setLocal(text);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => onChangeText(text), debounceMs);
    },
    [onChangeText, debounceMs],
  );

  const handleClear = useCallback(() => {
    setLocal("");
    if (timerRef.current) clearTimeout(timerRef.current);
    onChangeText("");
    inputRef.current?.focus();
  }, [onChangeText]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <View style={styles.container}>
      <Feather name="search" size={16} color={colors.textMuted} />
      <TextInput
        ref={inputRef}
        style={styles.input}
        value={local}
        onChangeText={handleChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textPlaceholder}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={autoFocus}
      />
      {loading && (
        <ActivityIndicator
          size="small"
          color={colors.textMuted}
          style={styles.loader}
        />
      )}
      {local.length > 0 && !loading && (
        <Pressable onPress={handleClear} hitSlop={8} style={styles.clearBtn}>
          <Feather name="x" size={14} color={colors.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    height: 44,
  },
  input: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.text,
    height: 44,
  },
  loader: {
    marginRight: spacing.xs,
  },
  clearBtn: {
    padding: spacing.xs,
  },
});
