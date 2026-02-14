/**
 * Acolyte Admin Mobile — Design tokens.
 *
 * Matches the web admin dashboard pixel-for-pixel.
 * Dark mode first, emerald accent, minimal and professional.
 */

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

export const colors = {
  // Backgrounds
  bg: "#0A0A0A",
  card: "#141414",
  cardHover: "#1A1A1A",
  border: "#1E1E1E",
  borderLight: "#2A2A2A",

  // Text
  text: "#F5F5F5",
  textSecondary: "#A0A0A0",
  textMuted: "#666666",
  textPlaceholder: "#4B5563",

  // Brand accent — emerald
  accent: "#10B981",
  accentDim: "#059669",
  accentBg: "rgba(16, 185, 129, 0.08)",
  accentBorder: "rgba(16, 185, 129, 0.2)",

  // Status — muted, professional
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  info: "#3B82F6",

  // Scan action type colors — subtle, not saturated
  actionMess: "#F59E0B",
  actionLibrary: "#3B82F6",
  actionAttendance: "#10B981",
  actionHostel: "#8B5CF6",
  actionClinical: "#EF4444",
  actionExam: "#F59E0B",

  // Action-type badge colors (per-type map)
  actionType: {
    mess_entry: "#F97316",
    library_checkout: "#3B82F6",
    library_return: "#60A5FA",
    attendance_mark: "#10B981",
    hostel_checkin: "#8B5CF6",
    lab_access: "#EC4899",
    exam_hall_entry: "#EF4444",
    parking_entry: "#6366F1",
    event_checkin: "#14B8A6",
    generic: "#666666",
  },

  // Backward-compat aliases (consumed by existing code; remove after full migration)
  background: "#0A0A0A",
  surface: "#141414",
  surfaceElevated: "#1A1A1A",
  surfaceOverlay: "#262626",
  primary: "#10B981",
  primaryMuted: "#059669",
  primaryDim: "rgba(16, 185, 129, 0.10)",
  textPrimary: "#F5F5F5",
  borderFocused: "#10B981",
  tabBarBg: "#0A0A0A",
  tabBarBorder: "#1E1E1E",
  tabActive: "#10B981",
  tabInactive: "#666666",
} as const;

// ---------------------------------------------------------------------------
// Spacing
// ---------------------------------------------------------------------------

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  // Backward-compat numeric keys
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
} as const;

// ---------------------------------------------------------------------------
// Border Radius
// ---------------------------------------------------------------------------

export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

// Alias
export const borderRadius = radius;

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

export const typography = {
  display: { fontSize: 28, fontWeight: "700" as const, letterSpacing: -0.5 },
  heading: { fontSize: 20, fontWeight: "600" as const, letterSpacing: -0.3 },
  subheading: { fontSize: 16, fontWeight: "600" as const },
  body: { fontSize: 15, fontWeight: "400" as const },
  caption: { fontSize: 13, fontWeight: "400" as const },
  small: {
    fontSize: 11,
    fontWeight: "500" as const,
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
  },
} as const;

// Backward-compat fontSize map (used by existing screens)
export const fontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 16,
  lg: 20,
  xl: 24,
  "2xl": 28,
  "3xl": 34,
} as const;
