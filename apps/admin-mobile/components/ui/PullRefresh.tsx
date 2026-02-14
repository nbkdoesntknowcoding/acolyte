import { RefreshControl } from "react-native";
import { colors } from "@/lib/theme";

interface PullRefreshProps {
  refreshing: boolean;
  onRefresh: () => void;
}

export function PullRefresh({ refreshing, onRefresh }: PullRefreshProps) {
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={colors.primary}
      colors={[colors.primary]}
      progressBackgroundColor={colors.surface}
    />
  );
}
