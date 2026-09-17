import React, { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { AppText } from "@/components/ui/AppText";
import Colors from "@/constants/colors";
import { radius, spacing } from "@/constants/theme";
import { useApp } from "@/lib/context";
import { useLanguage } from "@/lib/language-context";
import { getDefaultRouteForRole } from "@/lib/navigation";

export default function GetStartedScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useApp();
  const { t, language, setLanguage } = useLanguage();
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const heroTranslateY = useRef(new Animated.Value(22)).current;
  const heroScale = useRef(new Animated.Value(0.97)).current;
  const ctaOpacity = useRef(new Animated.Value(0)).current;
  const ctaTranslateY = useRef(new Animated.Value(14)).current;
  const logoFloat = useRef(new Animated.Value(0)).current;
  const orbLeft = useRef(new Animated.Value(0)).current;
  const orbRight = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(logoFloat, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(logoFloat, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    const leftOrbLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(orbLeft, {
          toValue: 1,
          duration: 5200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(orbLeft, {
          toValue: 0,
          duration: 5200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    const rightOrbLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(orbRight, {
          toValue: 1,
          duration: 6200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(orbRight, {
          toValue: 0,
          duration: 6200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    leftOrbLoop.start();
    rightOrbLoop.start();

    Animated.parallel([
      Animated.timing(heroOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(heroTranslateY, {
        toValue: 0,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(heroScale, {
        toValue: 1,
        friction: 7,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(ctaOpacity, {
        toValue: 1,
        duration: 360,
        delay: 160,
        useNativeDriver: true,
      }),
      Animated.timing(ctaTranslateY, {
        toValue: 0,
        duration: 480,
        delay: 160,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      floatLoop.start();
    });

    return () => {
      floatLoop.stop();
      leftOrbLoop.stop();
      rightOrbLoop.stop();
      logoFloat.stopAnimation();
      orbLeft.stopAnimation();
      orbRight.stopAnimation();
    };
  }, [ctaOpacity, ctaTranslateY, heroOpacity, heroScale, heroTranslateY, logoFloat, orbLeft, orbRight]);

  const handlePrimary = () => {
    if (user) {
      router.replace(getDefaultRouteForRole(user.role));
      return;
    }
    router.push("/(auth)/register");
  };

  const handleSecondary = () => {
    router.push("/(auth)/login");
  };

  const handleToggleLanguage = () => {
    setLanguage(language === "fr" ? "en" : "fr");
  };

  const primaryLabel = user ? t("Continue to App") : t("Get Started");
  const secondaryLabel = user ? t("Use Another Account") : t("Already have an account? Log in");
  const headline = user
    ? t("Welcome back, {name}", { name: user.name.split(" ")[0] })
    : "WasteTrack";
  const subtitle = user
    ? t("Lets continue into keeping our City clean.")
    : t("Smart waste pickup and issue reporting for cleaner neighborhoods.");

  const logoFloatTranslate = logoFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -7],
  });
  const leftOrbTranslateX = orbLeft.interpolate({ inputRange: [0, 1], outputRange: [-8, 8] });
  const leftOrbTranslateY = orbLeft.interpolate({ inputRange: [0, 1], outputRange: [8, -6] });
  const leftOrbScale = orbLeft.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.05] });
  const leftOrbOpacity = orbLeft.interpolate({ inputRange: [0, 1], outputRange: [0.34, 0.62] });
  const rightOrbTranslateX = orbRight.interpolate({ inputRange: [0, 1], outputRange: [10, -12] });
  const rightOrbTranslateY = orbRight.interpolate({ inputRange: [0, 1], outputRange: [-10, 8] });
  const rightOrbScale = orbRight.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.08] });
  const rightOrbOpacity = orbRight.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0.56] });

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#06342E", Colors.primaryDark, Colors.primary, Colors.primaryLight]}
        locations={[0, 0.32, 0.72, 1]}
        style={styles.gradient}
      >
        <View style={styles.orbLayer} pointerEvents="none">
          <Animated.View
            style={[
              styles.halfOrb,
              styles.halfOrbLeft,
              {
                opacity: leftOrbOpacity,
                transform: [
                  { translateX: leftOrbTranslateX },
                  { translateY: leftOrbTranslateY },
                  { scale: leftOrbScale },
                ],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.halfOrb,
              styles.halfOrbRight,
              {
                opacity: rightOrbOpacity,
                transform: [
                  { translateX: rightOrbTranslateX },
                  { translateY: rightOrbTranslateY },
                  { scale: rightOrbScale },
                ],
              },
            ]}
          />
        </View>

        <View style={[styles.topActions, { paddingTop: insets.top + 8 }]}>
          <Pressable
            style={({ pressed }) => [styles.langButton, pressed && { opacity: 0.9 }]}
            onPress={handleToggleLanguage}
            accessibilityRole="button"
            accessibilityLabel={t("Language")}
          >
            <Ionicons name="globe-outline" size={14} color="#fff" />
            <AppText variant="label" color="#fff">
              {language === "fr" ? "FR" : "EN"}
            </AppText>
          </Pressable>
        </View>

        <View style={[styles.content, { paddingTop: insets.top + 10 }]}>
          <Animated.View
            style={[
              styles.heroBlock,
              {
                opacity: heroOpacity,
                transform: [{ translateY: heroTranslateY }, { scale: heroScale }],
              },
            ]}
          >
            <Animated.Image
              source={require("../../assets/images/WasteTrack-transparent-matched.png")}
              style={[styles.logo, { transform: [{ translateY: logoFloatTranslate }] }]}
              resizeMode="contain"
            />
            <AppText style={styles.title} color="#fff">
              {headline}
            </AppText>
            <AppText style={styles.subtitle} color="rgba(255,255,255,0.92)">
              {subtitle}
            </AppText>

            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Ionicons name="trash-outline" size={16} color="#ffffff" />
                <AppText style={styles.summaryText} color="rgba(255,255,255,0.97)">
                  {t("Request pickup in seconds.")}
                </AppText>
              </View>
              <View style={styles.summaryRow}>
                <Ionicons name="navigate-outline" size={16} color="#ffffff" />
                <AppText style={styles.summaryText} color="rgba(255,255,255,0.97)">
                  {t("Track collector ETA live on map.")}
                </AppText>
              </View>
              <View style={styles.summaryRow}>
                <Ionicons name="warning-outline" size={16} color="#ffffff" />
                <AppText style={styles.summaryText} color="rgba(255,255,255,0.97)">
                  {t("Report illegal dumping quickly.")}
                </AppText>
              </View>
            </View>
          </Animated.View>
        </View>

        <Animated.View
          style={[
            styles.bottomActions,
            {
              paddingBottom: insets.bottom + 16,
              opacity: ctaOpacity,
              transform: [{ translateY: ctaTranslateY }],
            },
          ]}
        >
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && { opacity: 0.94, transform: [{ scale: 0.985 }] },
            ]}
            onPress={handlePrimary}
            testID="get-started-register-btn"
          >
            <AppText variant="button" color={Colors.primaryDark}>
              {primaryLabel}
            </AppText>
            <Ionicons name="arrow-forward" size={18} color={Colors.primaryDark} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.secondaryButton, pressed && { opacity: 0.78 }]}
            onPress={handleSecondary}
            testID="get-started-login-btn"
          >
            <AppText variant="label" color="rgba(255,255,255,0.95)">
              {secondaryLabel}
            </AppText>
          </Pressable>
        </Animated.View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  topActions: {
    position: "absolute",
    right: spacing.lg,
    left: spacing.lg,
    zIndex: 20,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  langButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.36)",
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  orbLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
  },
  halfOrb: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.62)",
    backgroundColor: "transparent",
  },
  halfOrbLeft: {
    width: 230,
    height: 230,
    borderRadius: 115,
    left: -154,
    bottom: -104,
  },
  halfOrbRight: {
    width: 390,
    height: 390,
    borderRadius: 195,
    right: -268,
    top: -176,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  heroBlock: {
    width: "100%",
    alignItems: "center",
    marginTop: 22,
  },
  logo: {
    width: 156,
    height: 156,
  },
  title: {
    marginTop: 2,
    fontSize: 33,
    lineHeight: 38,
    textAlign: "center",
  },
  subtitle: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    maxWidth: 420,
  },
  summaryCard: {
    marginTop: 22,
    width: "100%",
    maxWidth: 460,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    backgroundColor: "rgba(255,255,255,0.11)",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  summaryText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  bottomActions: {
    paddingHorizontal: 20,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: "#fff",
    borderRadius: 14,
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  secondaryButton: {
    minHeight: 28,
    alignItems: "center",
    justifyContent: "center",
  },
});