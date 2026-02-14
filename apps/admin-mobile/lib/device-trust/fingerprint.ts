import * as Application from "expo-application";
import * as Device from "expo-device";
import { Platform, Dimensions } from "react-native";

export interface DeviceInfoPayload {
  platform: "android" | "ios";
  device_id: string;
  device_model: string;
  device_manufacturer: string;
  os_version: string;
  app_version: string;
  screen_width: number;
  screen_height: number;
  ram_mb: number;
  sim_operator: string;
  sim_country: string;
}

export async function collectDeviceInfo(): Promise<DeviceInfoPayload> {
  const { width, height } = Dimensions.get("screen");
  const scale = Dimensions.get("screen").scale || 1;

  let deviceId = "";
  if (Platform.OS === "android") {
    deviceId = Application.getAndroidId() ?? `dev-android-${Date.now()}`;
  } else {
    deviceId =
      (await Application.getIosIdForVendorAsync()) ??
      `dev-ios-${Date.now()}`;
  }

  return {
    platform: Platform.OS as "android" | "ios",
    device_id: deviceId,
    device_model: Device.modelName ?? "Unknown",
    device_manufacturer: Device.manufacturer ?? "Unknown",
    os_version: Device.osVersion ?? "Unknown",
    app_version: Application.nativeApplicationVersion ?? "1.0.0",
    screen_width: Math.round(width * scale),
    screen_height: Math.round(height * scale),
    ram_mb: Device.totalMemory
      ? Math.round(Device.totalMemory / (1024 * 1024))
      : 0,
    sim_operator: "",
    sim_country: "IN",
  };
}
