// template
import { Link, router } from "expo-router";
import { useEffect } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useApp } from "@/lib/context";
import { useLanguage } from "@/lib/language-context";

const getHomeHref = (role?: string) => {
  if (role === "collector") return "/(collector)/assigned";
  if (role === "admin") return "/(public)/get-started";
  if (role === "resident") return "/(tabs)";
  return "/(public)/get-started";
};

export default function NotFoundScreen() {
  const { user } = useApp();
  const { t } = useLanguage();
  const homeHref = getHomeHref(user?.role);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const rawPath = window.location.pathname || "";
    if (!rawPath.includes("(")) return;
    const cleaned = rawPath
      .split("/")
      .filter((segment) => segment && !(segment.startsWith("(") && segment.endsWith(")")))
      .join("/");
    const target = cleaned.length === 0 || cleaned === "index" ? "/" : `/${cleaned}`;
    if (target !== rawPath) {
      router.replace(target as any);
    }
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("This screen doesn't exist.")}</Text>

      <Link href={homeHref} style={styles.link}>
        <Text style={styles.linkText}>{t("Go to home screen!")}</Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    fontSize: 14,
    color: "#2e78b7",
  },
});
