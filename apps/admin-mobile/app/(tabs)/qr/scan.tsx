import { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { colors, fontSize, spacing, radius } from "@/lib/theme";
import { useApi } from "@/lib/hooks/use-api";
import { qrApi, type ScanResult } from "@/lib/api/qr-api";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const VIEWFINDER_SIZE = SCREEN_WIDTH * 0.65;
const CORNER_LENGTH = 24;
const CORNER_WIDTH = 3;

// ---------------------------------------------------------------------------
// QR Parsing
// ---------------------------------------------------------------------------

function parseScannedQR(
  data: string,
): { type: "action" | "identity" | "unknown"; parsed?: any } {
  // Mode B action QR (acolyte:// URL)
  if (data.startsWith("acolyte://v1/")) {
    try {
      const url = new URL(data.replace("acolyte://", "https://acolyte.app/"));
      const pathParts = url.pathname.split("/");
      return {
        type: "action",
        parsed: {
          action_type: pathParts[2],
          action_point_id: url.searchParams.get("ap"),
          location_code: url.searchParams.get("lc"),
        },
      };
    } catch {
      return { type: "unknown" };
    }
  }

  // Mode A identity QR (JWT)
  if (data.startsWith("eyJ")) {
    return { type: "identity", parsed: { token: data } };
  }

  return { type: "unknown" };
}

// ---------------------------------------------------------------------------
// Result helpers
// ---------------------------------------------------------------------------

type ResultStatus = "success" | "duplicate" | "error" | "identity";

function getResultStatus(result: ScanResult): ResultStatus {
  if (result.action_type === "identity_info") return "identity";
  if (!result.success) {
    const msg = result.message.toLowerCase();
    if (msg.includes("already") || msg.includes("duplicate")) return "duplicate";
    return "error";
  }
  return "success";
}

function getStatusConfig(status: ResultStatus) {
  switch (status) {
    case "success":
      return {
        icon: "check-circle" as const,
        color: colors.accent,
        title: "Scan Successful",
      };
    case "duplicate":
      return {
        icon: "alert-triangle" as const,
        color: colors.warning,
        title: "Already Scanned",
      };
    case "error":
      return {
        icon: "alert-circle" as const,
        color: colors.error,
        title: "Scan Failed",
      };
    case "identity":
      return {
        icon: "info" as const,
        color: colors.info,
        title: "User Identity QR",
      };
  }
}

function formatActionType(raw?: string): string {
  if (!raw) return "";
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ScanScreen() {
  const api = useApi();
  const [permission, requestPermission] = useCameraPermissions();
  const [torchOn, setTorchOn] = useState(false);
  const [scanning, setScanning] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const lastScannedRef = useRef<string>("");

  // ----- Handle barcode scanned -----
  const handleBarcodeScanned = useCallback(
    async ({ data }: { data: string }) => {
      // Guard: already processing or same QR scanned consecutively
      if (!scanning || processing) return;
      if (data === lastScannedRef.current) return;

      lastScannedRef.current = data;
      setScanning(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const parsed = parseScannedQR(data);

      if (parsed.type === "action") {
        try {
          setProcessing(true);
          const scanResult = await qrApi.adminScanModeB(api, {
            scanned_qr_data: data,
          });
          setResult(scanResult);
        } catch (err: any) {
          setResult({
            success: false,
            message:
              err?.response?.data?.detail || err?.message || "Scan failed",
          });
        } finally {
          setProcessing(false);
        }
      } else if (parsed.type === "identity") {
        setResult({
          success: true,
          message:
            "This is a user identity QR. Fixed scanner devices read these automatically.",
          action_type: "identity_info",
        });
      } else {
        setResult({
          success: false,
          message: "Unrecognized QR code format",
        });
      }
    },
    [scanning, processing, api],
  );

  // ----- Reset for next scan -----
  const handleScanAnother = useCallback(() => {
    lastScannedRef.current = "";
    setResult(null);
    setScanning(true);
  }, []);

  // ----- Permission states -----
  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Feather
          name="camera-off"
          size={48}
          color={colors.textMuted}
          style={{ marginBottom: spacing.lg }}
        />
        <Text style={styles.permTitle}>Camera Permission Required</Text>
        <Text style={styles.permDesc}>
          Allow camera access to scan QR codes on campus.
        </Text>
        <Pressable style={styles.permButton} onPress={requestPermission}>
          <Text style={styles.permButtonText}>Grant Permission</Text>
        </Pressable>
      </View>
    );
  }

  // ----- Result card -----
  const resultStatus = result ? getResultStatus(result) : null;
  const statusConfig = resultStatus ? getStatusConfig(resultStatus) : null;

  return (
    <View style={styles.container}>
      {/* Camera */}
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        enableTorch={torchOn}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={scanning ? handleBarcodeScanned : undefined}
      />

      {/* Dark overlay with transparent viewfinder */}
      <View style={styles.overlay}>
        {/* Top */}
        <View style={styles.overlayTop}>
          <Text style={styles.scanTitle}>Scan QR Code</Text>
        </View>

        {/* Middle row: left + viewfinder + right */}
        <View style={styles.overlayMiddle}>
          <View style={styles.overlaySide} />
          <View style={styles.viewfinder}>
            {/* Corner marks */}
            {/* Top-left */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.cornerH, styles.cornerTL]} />
            {/* Top-right */}
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.cornerH, styles.cornerTR]} />
            {/* Bottom-left */}
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.cornerH, styles.cornerBL]} />
            {/* Bottom-right */}
            <View style={[styles.corner, styles.cornerBR]} />
            <View style={[styles.cornerH, styles.cornerBR]} />
          </View>
          <View style={styles.overlaySide} />
        </View>

        {/* Bottom */}
        <View style={styles.overlayBottom}>
          {!result && !processing && (
            <Text style={styles.helperText}>Point at a QR code</Text>
          )}
          {processing && (
            <View style={styles.processingRow}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.processingText}>Processing...</Text>
            </View>
          )}
        </View>
      </View>

      {/* Torch toggle */}
      <Pressable
        style={styles.torchButton}
        onPress={() => setTorchOn((prev) => !prev)}
      >
        <Feather
          name={torchOn ? "zap" : "zap-off"}
          size={20}
          color={torchOn ? colors.warning : colors.text}
        />
      </Pressable>

      {/* Result card */}
      {result && statusConfig && (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <Feather
              name={statusConfig.icon}
              size={24}
              color={statusConfig.color}
            />
            <View style={styles.resultHeaderText}>
              <Text style={[styles.resultTitle, { color: statusConfig.color }]}>
                {statusConfig.title}
              </Text>
              {result.action_type &&
                result.action_type !== "identity_info" && (
                  <Text style={styles.resultActionType}>
                    {formatActionType(result.action_type)}
                  </Text>
                )}
            </View>
          </View>

          <Text style={styles.resultMessage}>{result.message}</Text>

          {result.scan_log_id && (
            <Text style={styles.resultTimestamp}>
              Log: {result.scan_log_id.slice(0, 8)}... |{" "}
              {new Date().toLocaleTimeString()}
            </Text>
          )}

          <View style={styles.resultActions}>
            <Pressable
              style={styles.resultButtonSecondary}
              onPress={handleScanAnother}
            >
              <Feather name="refresh-cw" size={16} color={colors.accent} />
              <Text style={styles.resultButtonSecondaryText}>
                Scan Another
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.xl,
  },

  // Permission
  permTitle: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  permDesc: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  permButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
  },
  permButtonText: {
    fontSize: fontSize.base,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  // Overlay
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
  },
  overlayTop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: spacing.xl,
  },
  overlayMiddle: {
    flexDirection: "row",
    height: VIEWFINDER_SIZE,
  },
  overlaySide: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    paddingTop: spacing.xl,
  },

  scanTitle: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: colors.text,
  },

  // Viewfinder
  viewfinder: {
    width: VIEWFINDER_SIZE,
    height: VIEWFINDER_SIZE,
    borderRadius: radius.lg,
    position: "relative",
  },

  // Corner marks — vertical bars
  corner: {
    position: "absolute",
    width: CORNER_WIDTH,
    height: CORNER_LENGTH,
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
  // Corner marks — horizontal bars
  cornerH: {
    position: "absolute",
    width: CORNER_LENGTH,
    height: CORNER_WIDTH,
    backgroundColor: colors.accent,
    borderRadius: 2,
  },

  // Positions
  cornerTL: {
    top: 0,
    left: 0,
  },
  cornerTR: {
    top: 0,
    right: 0,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
  },

  // Helper / processing text
  helperText: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
  },
  processingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  processingText: {
    fontSize: fontSize.base,
    color: colors.accent,
    fontWeight: "500",
  },

  // Torch
  torchButton: {
    position: "absolute",
    top: spacing.lg,
    right: spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Result card
  resultCard: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  resultHeaderText: {
    flex: 1,
  },
  resultTitle: {
    fontSize: fontSize.md,
    fontWeight: "700",
  },
  resultActionType: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  resultMessage: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  resultTimestamp: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  resultActions: {
    flexDirection: "row",
    gap: spacing.md,
  },
  resultButtonSecondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  resultButtonSecondaryText: {
    fontSize: fontSize.base,
    fontWeight: "600",
    color: colors.accent,
  },
});
