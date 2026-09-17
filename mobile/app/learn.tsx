import React, { useCallback, useEffect, useState } from "react";
import {
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import Colors from "@/constants/colors";
import { AppText } from "@/components/ui/AppText";
import { fonts, fontSizes, radius, spacing } from "@/constants/theme";
import BottomWhiteScent from "@/components/BottomWhiteScent";
import EmptyState from "@/components/EmptyState";
import ErrorState from "@/components/ErrorState";
import { useLanguage } from "@/lib/language-context";
import { useTheme } from "@/lib/theme-context";
import { useToast } from "@/lib/toast-context";
import { apiRequest } from "@/lib/api-client";
import { normalizeMediaUrl } from "@/lib/media-url";
import * as storage from "@/lib/storage";

type ContentItem = {
  id: string;
  title: string;
  body: string;
  media_url: string | null;
  created_at: string;
  updated_at: string;
};

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export default function LearnScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const toast = useToast();

  const [content, setContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadContent = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Try cache first if stale or empty
    try {
      const [cached, cachedTs] = await Promise.all([
        storage.getEducationContent(),
        storage.getEducationContentTs(),
      ]);
      const isStale = Date.now() - cachedTs > CACHE_TTL_MS;

      if (cached.length > 0 && isStale) {
        // Show cached data while refreshing in background
        setContent(cached);
      } else if (cached.length > 0 && !isStale) {
        setContent(cached);
        setLoading(false);
        return;
      }
    } catch {
      // Ignore cache errors
    }

    // Fetch from network
    try {
      const data = await apiRequest<{ success: true; content: ContentItem[] }>(
        "GET",
        "/content"
      );
      setContent(data.content);
      // Cache for offline use
      try {
        await storage.saveEducationContent(data.content);
      } catch {
        // Ignore cache write errors
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : t("Failed to load tips");
      // If we have cached data, show it without error
      if (content.length === 0) {
        setError(message);
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  }, [toast, t, content.length]);

  useEffect(() => {
    void loadContent();
  }, [loadContent]);

  if (error && content.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ErrorState
          title={t("Could not load tips")}
          description={error}
          retryLabel={t("Retry")}
          onRetry={() => void loadContent()}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <BottomWhiteScent />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: 120,
          paddingHorizontal: 20,
        }}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void loadContent()}
            tintColor={Colors.primary}
          />
        }
      >
        <AppText variant="title" style={styles.heading} color={colors.text}>
          {t("Learn & Recycling Tips")}
        </AppText>
        <AppText color={colors.textSecondary} style={styles.subheading}>
          {t("Practical advice to manage waste responsibly in your community.")}
        </AppText>

        {loading && content.length === 0 ? (
          <View style={styles.loadingContainer}>
            <AppText variant="body" style={styles.loadingText} color={colors.textSecondary}>
              {t("Loading tips...")}
            </AppText>
          </View>
        ) : content.length === 0 ? (
          <EmptyState
            title={t("No tips yet")}
            description={t("Check back soon for new recycling and waste management tips.")}
          />
        ) : (
          <View style={styles.list}>
            {content.map((item) => {
              const imageUri = normalizeMediaUrl(item.media_url);
              return (
                <View
                  key={item.id}
                  style={[
                    styles.card,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  {imageUri ? (
                    <Image
                      source={{ uri: imageUri }}
                      style={styles.contentImage}
                      resizeMode="cover"
                    />
                  ) : null}
                  <View style={styles.cardBody}>
                    <AppText style={styles.cardTitle} color={colors.text}>
                      {item.title}
                    </AppText>
                    <AppText style={styles.cardText} color={colors.textSecondary}>
                      {item.body}
                    </AppText>
                    <View style={styles.cardMeta}>
                      <Ionicons
                        name="leaf-outline"
                        size={12}
                        color={Colors.primary}
                      />
                      <AppText variant="caption" color={colors.textSecondary}>
                        {new Date(item.updated_at).toLocaleDateString()}
                      </AppText>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heading: {
    fontSize: fontSizes.hero,
    marginBottom: 6,
  },
  subheading: {
    fontSize: fontSizes.md,
    lineHeight: 20,
    marginBottom: 20,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  loadingText: {
    fontSize: fontSizes.md,
  },
  list: {
    gap: spacing.md,
  },
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: "hidden",
  },
  contentImage: {
    width: "100%",
    height: 180,
  },
  cardBody: {
    padding: spacing.md + 2,
  },
  cardTitle: {
    fontSize: fontSizes.button,
    fontFamily: fonts.semibold,
    marginBottom: 6,
  },
  cardText: {
    fontSize: fontSizes.md,
    fontFamily: fonts.regular,
    lineHeight: 20,
    marginBottom: 10,
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
});