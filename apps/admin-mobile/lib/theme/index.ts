/**
 * Acolyte Admin — Dark theme tokens.
 *
 * Same palette as the web admin dashboard so users get a consistent
 * visual language across desktop and mobile.
 */

export const colors = {
  // Backgrounds
  background: "#0A0A0F",
  surface: "#12121A",
  surfaceElevated: "#1A1A24",
  surfaceOverlay: "#222230",

  // Brand
  primary: "#00FF88",
  primaryMuted: "#00CC6A",
  primaryDim: "rgba(0, 255, 136, 0.10)",

  // Text
  textPrimary: "#FFFFFF",
  textSecondary: "#9CA3AF",
  textMuted: "#6B7280",
  textPlaceholder: "#4B5563",

  // Borders
  border: "#1E1E2E",
  borderFocused: "#00FF88",

  // Status
  success: "#22C55E",
  warning: "#F59E0B",
  error: "#EF4444",
  info: "#3B82F6",

  // Action-type badge colors (QR scan log)
  actionType: {
    mess_entry: "#F97316",       // orange
    library_checkout: "#3B82F6", // blue
    library_return: "#60A5FA",   // light-blue
    attendance_mark: "#22C55E",  // green
    hostel_checkin: "#A855F7",   // purple
    lab_access: "#EC4899",       // pink
    exam_hall_entry: "#EF4444",  // red
    parking_entry: "#6366F1",    // indigo
    event_checkin: "#14B8A6",    // teal
    generic: "#6B7280",          // gray
  },

  // Tab bar
  tabBarBg: "#0D0D14",
  tabBarBorder: "#1A1A24",
  tabActive: "#00FF88",
  tabInactive: "#4B5563",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
} as const;

export const fontSize = {
  xs: 10,
  sm: 12,
  base: 14,
  md: 16,
  lg: 18,
  xl: 22,
  "2xl": 28,
  "3xl": 34,
} as const;
