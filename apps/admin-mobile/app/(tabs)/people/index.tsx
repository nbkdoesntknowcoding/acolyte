import { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  StyleSheet,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { colors, spacing, fontSize, radius } from "@/lib/theme";
import {
  useStudentSearch,
  useFacultySearch,
} from "@/lib/hooks/use-people-search";
import { Badge } from "@/components/ui/Badge";
import { PullRefresh } from "@/components/ui/PullRefresh";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import type { StudentSummary, FacultySummary } from "@/lib/api/admin-api";

type PeopleTab = "students" | "faculty";

const MAX_RECENT = 8;

export default function PeopleScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<PeopleTab>("students");
  const [search, setSearch] = useState("");
  const inputRef = useRef<TextInput>(null);

  // Recent searches (session-only — MMKV replaced for Expo Go compat)
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const addRecent = useCallback(
    (term: string) => {
      const trimmed = term.trim();
      if (trimmed.length < 2) return;
      setRecentSearches((prev) =>
        [trimmed, ...prev.filter((s) => s !== trimmed)].slice(0, MAX_RECENT),
      );
    },
    [],
  );

  const clearRecent = useCallback(() => {
    setRecentSearches([]);
  }, []);

  // Auto-focus search on mount
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, []);

  // Data hooks
  const {
    data: studentsData,
    isLoading: studentsLoading,
    isRefetching: studentsRefetching,
    refetch: refetchStudents,
  } = useStudentSearch(tab === "students" ? search : "");

  const {
    data: facultyData,
    isLoading: facultyLoading,
    isRefetching: facultyRefetching,
    refetch: refetchFaculty,
  } = useFacultySearch(tab === "faculty" ? search : "");

  const students = studentsData?.data ?? [];
  const faculty = facultyData?.data ?? [];
  const isLoading = tab === "students" ? studentsLoading : facultyLoading;
  const isRefreshing =
    tab === "students" ? studentsRefetching : facultyRefetching;
  const hasSearch = search.length >= 2;

  const onRefresh = useCallback(() => {
    if (tab === "students") refetchStudents();
    else refetchFaculty();
  }, [tab, refetchStudents, refetchFaculty]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>People</Text>
      </View>

      {/* Segment toggle */}
      <View style={styles.segmentWrap}>
        <View style={styles.segmentRow}>
          {(["students", "faculty"] as const).map((key) => {
            const active = tab === key;
            return (
              <Pressable
                key={key}
                onPress={() => {
                  setTab(key);
                  setSearch("");
                }}
                style={[styles.segmentPill, active && styles.segmentActive]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    active && styles.segmentTextActive,
                  ]}
                >
                  {key === "students" ? "Students" : "Faculty"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Search bar */}
      <View style={styles.searchWrap}>
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder={
              tab === "students"
                ? "Search by name, enrollment, phone..."
                : "Search by name, NMC ID, phone..."
            }
            placeholderTextColor={colors.textPlaceholder}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => {
              if (search.length >= 2) addRecent(search);
              Keyboard.dismiss();
            }}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} style={styles.clearBtn}>
              <Text style={styles.clearText}>✕</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Content */}
      {!hasSearch ? (
        // Show recent searches when no active search
        <View style={styles.recentArea}>
          {recentSearches.length > 0 && (
            <>
              <View style={styles.recentHeader}>
                <Text style={styles.recentTitle}>Recent Searches</Text>
                <Pressable onPress={clearRecent}>
                  <Text style={styles.clearAllText}>Clear</Text>
                </Pressable>
              </View>
              <View style={styles.recentChips}>
                {recentSearches.map((term) => (
                  <Pressable
                    key={term}
                    onPress={() => setSearch(term)}
                    style={({ pressed }) => [
                      styles.recentChip,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={styles.recentChipText}>{term}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
          {recentSearches.length === 0 && (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyTitle}>Search People</Text>
              <Text style={styles.emptyDesc}>
                Find students or faculty by name, enrollment number, phone, or
                NEET roll number.
              </Text>
            </View>
          )}
        </View>
      ) : tab === "students" ? (
        <FlatList
          data={students}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <PullRefresh refreshing={isRefreshing} onRefresh={onRefresh} />
          }
          renderItem={({ item }) => (
            <StudentRow
              student={item}
              onPress={() => {
                addRecent(search);
                router.push({
                  pathname: "/(tabs)/people/student/[id]",
                  params: { id: item.id },
                });
              }}
            />
          )}
          ListEmptyComponent={
            isLoading ? (
              <View style={styles.skeletonWrap}>
                {[1, 2, 3].map((i) => (
                  <SkeletonLoader key={i} height={80} />
                ))}
              </View>
            ) : (
              <Text style={styles.noResults}>
                No students match &quot;{search}&quot;
              </Text>
            )
          }
        />
      ) : (
        <FlatList
          data={faculty}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <PullRefresh refreshing={isRefreshing} onRefresh={onRefresh} />
          }
          renderItem={({ item }) => (
            <FacultyRow
              faculty={item}
              onPress={() => {
                addRecent(search);
                router.push({
                  pathname: "/(tabs)/people/faculty/[id]",
                  params: { id: item.id },
                });
              }}
            />
          )}
          ListEmptyComponent={
            isLoading ? (
              <View style={styles.skeletonWrap}>
                {[1, 2, 3].map((i) => (
                  <SkeletonLoader key={i} height={80} />
                ))}
              </View>
            ) : (
              <Text style={styles.noResults}>
                No faculty match &quot;{search}&quot;
              </Text>
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Student row
// ---------------------------------------------------------------------------

function StudentRow({
  student,
  onPress,
}: {
  student: StudentSummary;
  onPress: () => void;
}) {
  const initials = student.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
    >
      <View style={[styles.avatar, { backgroundColor: colors.info + "20" }]}>
        <Text style={[styles.avatarText, { color: colors.info }]}>
          {initials}
        </Text>
      </View>
      <View style={styles.rowContent}>
        <Text style={styles.rowName} numberOfLines={1}>
          {student.name}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {student.enrollment_number} · {student.current_phase}
          {student.batch ? ` · Batch ${student.batch}` : ""}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {student.program ?? "MBBS"}
          {student.quota ? ` · ${student.quota} Quota` : ""}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Faculty row
// ---------------------------------------------------------------------------

function FacultyRow({
  faculty,
  onPress,
}: {
  faculty: FacultySummary;
  onPress: () => void;
}) {
  const initials = faculty.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
    >
      <View
        style={[styles.avatar, { backgroundColor: colors.primary + "20" }]}
      >
        <Text style={[styles.avatarText, { color: colors.primary }]}>
          {initials}
        </Text>
      </View>
      <View style={styles.rowContent}>
        <Text style={styles.rowName} numberOfLines={1}>
          {faculty.name}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {faculty.designation}
          {faculty.department_name ? ` · ${faculty.department_name}` : ""}
        </Text>
        {faculty.nmc_faculty_id && (
          <Text style={styles.rowMeta} numberOfLines={1}>
            NMC ID: {faculty.nmc_faculty_id}
          </Text>
        )}
      </View>
      <Badge
        label={faculty.status}
        variant={faculty.status === "active" ? "success" : "outline"}
      />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

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

  // Segment
  segmentWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
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

  // Search
  searchWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  searchIcon: {
    fontSize: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.textPrimary,
    height: 48,
  },
  clearBtn: {
    padding: spacing.xs,
  },
  clearText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },

  // Recent
  recentArea: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  recentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  recentTitle: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  clearAllText: {
    fontSize: fontSize.xs,
    color: colors.primary,
    fontWeight: "600",
  },
  recentChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  recentChip: {
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  recentChipText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },

  // Empty
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: spacing["4xl"],
    gap: spacing.sm,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  emptyDesc: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 20,
  },

  // List
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing["4xl"],
    gap: spacing.sm,
  },
  skeletonWrap: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  noResults: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: "center",
    paddingVertical: spacing["4xl"],
  },

  // Row
  row: {
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
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: fontSize.base,
    fontWeight: "700",
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    fontSize: fontSize.base,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  rowSub: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  rowMeta: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  chevron: {
    fontSize: fontSize.xl,
    color: colors.textMuted,
    fontWeight: "300",
  },
});
