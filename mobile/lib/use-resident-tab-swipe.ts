import { useMemo, useRef } from "react";
import {
  PanResponder,
  Platform,
  type GestureResponderHandlers,
  type PanResponderGestureState,
} from "react-native";
import { router } from "expo-router";

type ResidentTab = "index" | "schedule" | "rewards" | "profile";

const TAB_ORDER: ResidentTab[] = ["index", "schedule", "rewards", "profile"];
const TAB_ROUTES = {
  index: "/(tabs)",
  schedule: "/(tabs)/schedule",
  rewards: "/(tabs)/rewards",
  profile: "/(tabs)/profile",
} as const satisfies Record<ResidentTab, string>;

const ACTIVATE_THRESHOLD_X = 22;
const COMMIT_THRESHOLD_X = 70;
const HORIZONTAL_DOMINANCE_RATIO = 1.2;

const isHorizontalSwipe = (gestureState: PanResponderGestureState, thresholdX: number) => {
  const horizontal = Math.abs(gestureState.dx);
  const vertical = Math.abs(gestureState.dy);
  return horizontal > thresholdX && horizontal > vertical * HORIZONTAL_DOMINANCE_RATIO;
};

export const useResidentTabSwipe = (currentTab: ResidentTab): GestureResponderHandlers => {
  const isNavigatingRef = useRef(false);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gestureState) => {
          if (Platform.OS === "web") return false;
          return isHorizontalSwipe(gestureState, ACTIVATE_THRESHOLD_X);
        },
        onPanResponderTerminationRequest: () => true,
        onPanResponderRelease: (_, gestureState) => {
          if (Platform.OS === "web") return;
          if (isNavigatingRef.current) return;
          if (!isHorizontalSwipe(gestureState, COMMIT_THRESHOLD_X)) return;

          const currentIndex = TAB_ORDER.indexOf(currentTab);
          if (currentIndex < 0) return;

          const direction = gestureState.dx < 0 ? 1 : -1;
          const nextIndex = currentIndex + direction;
          if (nextIndex < 0 || nextIndex >= TAB_ORDER.length) return;

          const nextTab = TAB_ORDER[nextIndex];
          const nextRoute = TAB_ROUTES[nextTab];

          isNavigatingRef.current = true;
          router.replace(nextRoute);

          setTimeout(() => {
            isNavigatingRef.current = false;
          }, 180);
        },
      }),
    [currentTab],
  );

  return panResponder.panHandlers;
};
