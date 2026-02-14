import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { useUser } from "@clerk/clerk-expo";
import * as Brightness from "expo-brightness";
import QRCode from "react-native-qrcode-svg";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, fontSize, radius, typography } from "@/lib/theme";
import { useIdentityQR } from "@/lib/hooks/use-identity-qr";
import { TimerRing } from "@/components/qr/TimerRing";
import { Skeleton } from "@/components/ui/Skeleton";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function QRScreen() {
  const { user } = useUser();
  const { token, secondsLeft, maxSeconds, loading, error, refresh } =
    useIdentityQR();
  const qrOpacity = useRef(new Animated.Value(1)).current;
  const prevBrightness = useRef<number | null>(null);

  // Brightness boost on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const current = await Brightness.getBrightnessAsync();
        if (mounted) {
          prevBrightness.current = current;
          await Brightness.setBrightnessAsync(1);
        }
      } catch {
        // expo-brightness may not be available in Expo Go
      }
    })();
    return () => {
      mounted = false;
      if (prevBrightness.current != null) {
        Brightness.setBrightnessAsync(prevBrightness.current).catch(() => {});
      }
    };
  }, []);

  // Fade QR on refresh
  useEffect(() => {
    if (loading && token) {
      Animated.timing(qrOpacity, {
        toValue: 0.3,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(qrOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [loading, token, qrOpacity]);

  const timerColor =
    secondsLeft <= 15
      ? colors.error
      : secondsLeft <= 60
        ? colors.warning
        : colors.accent;

  const displayName = user?.fullName ?? user?.firstName ?? "Admin";
  const orgName = user?.organizationMemberships?.[0]?.organization?.name ?? "";

  return (
    <View style={styles.safe}>
      <View style={styles.container}>
        {/* Profile info */}
        <View style={styles.profile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.firstName?.[0] ?? "A").toUpperCase()}
            </Text>
          </View>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.role}>Administrator</Text>
          {orgName ? <Text style={styles.org}>{orgName}</Text> : null}
        </View>

        {/* QR Code */}
        <View style={styles.qrArea}>
          {error ? (
            <View style={styles.errorWrap}>
              <Feather name="alert-circle" size={40} color={colors.error} />
              <Text style={styles.errorText}>{error}</Text>
              <Text
                style={styles.retryLink}
                onPress={refresh}
              >
                Retry
              </Text>
            </View>
          ) : loading && !token ? (
            <Skeleton width={260} height={260} borderRadius={radius.lg} />
          ) : token ? (
            <View style={styles.qrContainer}>
              <TimerRing
                secondsLeft={secondsLeft}
                maxSeconds={maxSeconds}
                size={300}
                strokeWidth={2}
              />
              <Animated.View
                style={[styles.qrInner, { opacity: qrOpacity }]}
              >
                <QRCode
                  value={token}
                  size={240}
                  color="#FFFFFF"
                  backgroundColor="transparent"
                />
              </Animated.View>
            </View>
          ) : null}
        </View>

        {/* Timer */}
        {token && !error && (
          <View style={styles.timerArea}>
            <View style={[styles.timerDot, { backgroundColor: timerColor }]} />
            <Text style={[styles.timerText, { color: timerColor }]}>
              {formatTime(secondsLeft)} remaining
            </Text>
          </View>
        )}
        {token && !error && (
          <Text style={styles.autoRefresh}>Auto-refreshing</Text>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.divider} />
          <Text style={styles.footerTitle}>Your campus passkey</Text>
          <Text style={styles.footerDesc}>
            Show at mess, library, hostel gates
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },

  // Profile
  profile: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  avatarText: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.accent,
  },
  name: {
    ...typography.heading,
    color: colors.text,
  },
  role: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  org: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },

  // QR
  qrArea: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 300,
  },
  qrContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  qrInner: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  errorWrap: {
    alignItems: "center",
    gap: spacing.md,
  },
  errorText: {
    fontSize: fontSize.base,
    color: colors.error,
    textAlign: "center",
  },
  retryLink: {
    fontSize: fontSize.base,
    fontWeight: "600",
    color: colors.accent,
  },

  // Timer
  timerArea: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  timerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  timerText: {
    fontSize: fontSize.base,
    fontWeight: "500",
  },
  autoRefresh: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },

  // Footer
  footer: {
    alignItems: "center",
    marginTop: spacing.xxl,
  },
  divider: {
    width: 40,
    height: 1,
    backgroundColor: colors.border,
    marginBottom: spacing.lg,
  },
  footerTitle: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontWeight: "500",
  },
  footerDesc: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});
