import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useTheme } from "@/lib/theme-context";

type ToastType = "success" | "error" | "info";

type ToastState = {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
};

type ToastShowInput = {
  type: ToastType;
  title: string;
  message?: string;
  durationMs?: number;
};

type ToastHelpers = {
  message?: string;
  durationMs?: number;
};

type ToastContextValue = {
  show: (input: ToastShowInput) => void;
  success: (title: string, helpers?: ToastHelpers) => void;
  error: (title: string, helpers?: ToastHelpers) => void;
  info: (title: string, helpers?: ToastHelpers) => void;
  dismiss: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function getToastAccent(type: ToastType): string {
  switch (type) {
    case "success":
      return Colors.success;
    case "error":
      return Colors.error;
    case "info":
      return Colors.primary;
  }
}

function getToastIcon(type: ToastType): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case "success":
      return "checkmark-circle";
    case "error":
      return "close-circle";
    case "info":
      return "information-circle";
  }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastIdRef = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-12)).current;
  const isDismissingRef = useRef(false);
  const useNativeDriver = Platform.OS !== "web";

  const dismiss = useCallback((expectedId?: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (expectedId && toastIdRef.current !== expectedId) {
      return;
    }

    const currentId = toastIdRef.current;
    if (!currentId) {
      setToast(null);
      return;
    }

    if (isDismissingRef.current) {
      return;
    }
    isDismissingRef.current = true;

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 160,
        easing: Easing.in(Easing.cubic),
        useNativeDriver,
      }),
      Animated.timing(translateY, {
        toValue: -12,
        duration: 160,
        easing: Easing.in(Easing.cubic),
        useNativeDriver,
      }),
    ]).start(() => {
      isDismissingRef.current = false;
      setToast((current) => (current?.id === currentId ? null : current));
      if (toastIdRef.current === currentId) {
        toastIdRef.current = null;
      }
    });
  }, [opacity, translateY, useNativeDriver]);

  const show = useCallback((input: ToastShowInput) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    toastIdRef.current = id;
    setToast({
      id,
      type: input.type,
      title: input.title,
      message: input.message,
    });

    isDismissingRef.current = false;
    opacity.stopAnimation();
    translateY.stopAnimation();
    opacity.setValue(0);
    translateY.setValue(-12);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver,
      }),
    ]).start();

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    const durationMs = typeof input.durationMs === "number" ? input.durationMs : 3000;
    timeoutRef.current = setTimeout(() => {
      dismiss(id);
      timeoutRef.current = null;
    }, durationMs);
  }, [dismiss, opacity, translateY, useNativeDriver]);

  const value: ToastContextValue = useMemo(
    () => ({
      show,
      dismiss,
      success: (title, helpers) => show({ type: "success", title, ...helpers }),
      error: (title, helpers) => show({ type: "error", title, ...helpers }),
      info: (title, helpers) => show({ type: "info", title, ...helpers }),
    }),
    [dismiss, show]
  );

  const topOffset = insets.top + (Platform.OS === "web" ? 78 : 12);
  const accent = toast ? getToastAccent(toast.type) : Colors.primary;
  const icon = toast ? getToastIcon(toast.type) : "information-circle";

  return (
    <ToastContext.Provider value={value}>
      <View style={styles.root}>
        {children}

        {toast ? (
          <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            <View pointerEvents="box-none" style={[styles.host, { top: topOffset }]}>
              <Animated.View
                style={{
                  opacity,
                  transform: [{ translateY }],
                  width: "100%",
                  alignItems: "center",
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss notification"
                  onPress={() => dismiss()}
                  style={({ pressed }) => [
                    styles.toast,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                    pressed && { transform: [{ scale: 0.99 }] },
                  ]}
                >
                  <View style={[styles.accent, { backgroundColor: accent }]} />
                  <Ionicons name={icon} size={20} color={accent} />
                  <View style={styles.textCol}>
                    <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
                      {toast.title}
                    </Text>
                    {toast.message ? (
                      <Text style={[styles.message, { color: colors.textSecondary }]} numberOfLines={3}>
                        {toast.message}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons name="close" size={18} color={colors.textSecondary} />
                </Pressable>
              </Animated.View>
            </View>
          </View>
        ) : null}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  host: {
    position: "absolute",
    left: 12,
    right: 12,
    alignItems: "center",
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: "100%",
    maxWidth: 520,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  accent: {
    width: 4,
    height: "100%",
    borderRadius: 4,
  },
  textCol: { flex: 1 },
  title: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  message: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
});
