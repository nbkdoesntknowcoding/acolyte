import { Stack } from "expo-router";
import { colors } from "@/lib/theme";

export default function CampusLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: "slide_from_right",
      }}
    />
  );
}
