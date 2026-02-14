import { Feather, Ionicons } from "@expo/vector-icons";
import { colors } from "@/lib/theme";

type FeatherName = React.ComponentProps<typeof Feather>["name"];
type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

/** Semantic icon name → Feather icon mapping */
export const ACTION_ICONS: Record<string, FeatherName> = {
  // QR action types
  mess_entry: "coffee",
  library_checkout: "book-open",
  library_return: "book",
  attendance_mark: "check-square",
  hostel_checkin: "home",
  lab_access: "activity",
  exam_hall_entry: "edit-3",
  parking_entry: "square",
  event_checkin: "calendar",

  // Approval types
  leave: "calendar",
  certificate: "file-text",
  transfer: "refresh-cw",
  enrollment: "user-plus",
  fee_waiver: "dollar-sign",

  // Activity types
  leave_approved: "check-circle",
  leave_rejected: "x-circle",
  student_enrolled: "user-plus",
  device_reset: "smartphone",
  notice_published: "volume-2",
  fee_received: "dollar-sign",
  certificate_issued: "file-text",
  faculty_joined: "user-check",
  role_assigned: "key",

  // Generic fallback
  generic: "file",
};

/** Validation status → icon + color */
export const STATUS_ICONS: Record<
  string,
  { name: FeatherName; color: string }
> = {
  success: { name: "check-circle", color: colors.success },
  warning: { name: "alert-triangle", color: colors.warning },
  error: { name: "x-circle", color: colors.error },
  info: { name: "info", color: colors.info },
  duplicate: { name: "alert-triangle", color: colors.textMuted },
};

/** Standard icon sizes */
export const ICON_SIZE = {
  inline: 16,
  list: 20,
  card: 24,
  tab: 24,
  header: 28,
} as const;

interface AppIconProps {
  name: FeatherName;
  size?: number;
  color?: string;
}

/** Reusable Feather icon wrapper with theme defaults */
export function AppIcon({
  name,
  size = ICON_SIZE.list,
  color = colors.textMuted,
}: AppIconProps) {
  return <Feather name={name} size={size} color={color} />;
}

interface AppIoniconsProps {
  name: IoniconsName;
  size?: number;
  color?: string;
}

/** Ionicons wrapper for icons Feather doesn't have (e.g. QR code) */
export function AppIonicon({
  name,
  size = ICON_SIZE.list,
  color = colors.textMuted,
}: AppIoniconsProps) {
  return <Ionicons name={name} size={size} color={color} />;
}

export { Feather, Ionicons };
export type { FeatherName, IoniconsName };
