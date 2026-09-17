import React, { useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import Colors from "@/constants/colors";
import { AppText } from "@/components/ui/AppText";
import { fonts, fontSizes, radius, spacing } from "@/constants/theme";
import { useApp } from "@/lib/context";
import { useLanguage } from "@/lib/language-context";
import { useTheme } from "@/lib/theme-context";

type GuideAudience = "resident" | "collector";

type GuideStep = {
  id: string;
  titleKey: string;
  subtitleKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  screenshotName: string;
  actions: string[];
};

const RESIDENT_GUIDE_STEPS: GuideStep[] = [
  {
    id: "resident-auth",
    titleKey: "Create account and sign in",
    subtitleKey: "Register, verify your details, and sign in to access your dashboard.",
    icon: "person-add",
    color: Colors.primary,
    screenshotName: "resident-01-register-login.png",
    actions: [
      "Open Register from the welcome screen.",
      "Enter personal details, location, password, and confirm password.",
      "Review your details and create the account.",
      "Sign in with your email and password.",
    ],
  },
  {
    id: "resident-home",
    titleKey: "Home dashboard overview",
    subtitleKey: "Understand greeting cards, quick actions, and current request status.",
    icon: "home",
    color: Colors.secondary,
    screenshotName: "resident-02-home-dashboard.png",
    actions: [
      "Use the Pickup button to create a new pickup request.",
      "Use the Report button to submit a waste issue.",
      "Check active cards to see request progress.",
    ],
  },
  {
    id: "resident-pickup",
    titleKey: "Submit a pickup request",
    subtitleKey: "Complete details, schedule, and review before submitting.",
    icon: "cube",
    color: Colors.waste.household,
    screenshotName: "resident-03-pickup-form.png",
    actions: [
      "Choose waste type, location, date, and time.",
      "Upload a waste photo when needed.",
      "Review the summary and submit the request.",
    ],
  },
  {
    id: "resident-tracking",
    titleKey: "Track assigned collector",
    subtitleKey: "Follow assignment updates and open live tracking when collector accepts.",
    icon: "navigate",
    color: Colors.warning,
    screenshotName: "resident-04-pickup-tracking.png",
    actions: [
      "Open Pickup Tracking from dashboard or notifications.",
      "Review assigned collector details and route status.",
      "Confirm completion after pickup proof is submitted.",
    ],
  },
  {
    id: "resident-report",
    titleKey: "Submit a waste report",
    subtitleKey: "Report illegal dumping or overflowing bins with location and evidence.",
    icon: "warning",
    color: Colors.error,
    screenshotName: "resident-05-report-form.png",
    actions: [
      "Choose the report type and add location details.",
      "Attach photo evidence if available.",
      "Review report details and submit.",
    ],
  },
  {
    id: "resident-notify-history",
    titleKey: "Monitor notifications and history",
    subtitleKey: "Use notifications and history to follow all request updates.",
    icon: "notifications",
    color: Colors.primaryDark,
    screenshotName: "resident-06-notifications-history.png",
    actions: [
      "Open Notification Center to filter update categories.",
      "Open History to review pickups and reports timeline.",
      "Use status chips to filter records.",
    ],
  },
  {
    id: "resident-profile",
    titleKey: "Profile, rewards, and settings",
    subtitleKey: "Manage account, language, schedule preferences, and rewards progress.",
    icon: "settings",
    color: "#0EA5E9",
    screenshotName: "resident-07-profile-settings-rewards.png",
    actions: [
      "Open Rewards to track points and badges.",
      "Update profile and schedule preferences in Settings.",
      "Use language switcher to change app language.",
    ],
  },
];

const COLLECTOR_GUIDE_STEPS: GuideStep[] = [
  {
    id: "collector-auth",
    titleKey: "Collector approval and sign in",
    subtitleKey: "Sign in with collector account and check approval status.",
    icon: "shield-checkmark",
    color: Colors.secondary,
    screenshotName: "collector-01-approval-login.png",
    actions: [
      "If pending approval, the app shows collector submitted status.",
      "After approval, first login shows success screen.",
      "Next logins open collector dashboard directly.",
    ],
  },
  {
    id: "collector-assigned",
    titleKey: "Review assigned tasks",
    subtitleKey: "Use Assigned tab to view pickups and reports matched to you.",
    icon: "list",
    color: Colors.primary,
    screenshotName: "collector-02-assigned-tasks.png",
    actions: [
      "Check urgency sections: Urgent, Today, and Upcoming.",
      "Use filters: All, Pickups, Reports.",
      "Open task details before taking action.",
    ],
  },
  {
    id: "collector-offers",
    titleKey: "Accept or reject dispatch offers",
    subtitleKey: "Respond fast to assignment offers before countdown expires.",
    icon: "flash",
    color: Colors.warning,
    screenshotName: "collector-03-offer-accept-reject.png",
    actions: [
      "Open incoming offer card in Assigned screen.",
      "Tap Accept to reserve the task.",
      "Tap Reject to forward it to the next nearest collector.",
    ],
  },
  {
    id: "collector-map",
    titleKey: "Navigate with collector map",
    subtitleKey: "Start route guidance from your location to pickup/report destination.",
    icon: "map",
    color: "#0891B2",
    screenshotName: "collector-04-route-map.png",
    actions: [
      "Open Collector Map from assigned task.",
      "Verify both your position and destination markers.",
      "Start navigation and follow the traced route.",
    ],
  },
  {
    id: "collector-pickup-proof",
    titleKey: "Complete pickup with proof",
    subtitleKey: "Submit completion note and optional photo after pickup.",
    icon: "camera",
    color: Colors.waste.household,
    screenshotName: "collector-05-pickup-proof.png",
    actions: [
      "Open task details and tap Start when pickup begins.",
      "After collection, tap Complete and add proof.",
      "Resident receives confirmation request for validation.",
    ],
  },
  {
    id: "collector-report-proof",
    titleKey: "Clean waste report with proof",
    subtitleKey: "Handle report cleanup tasks and submit evidence.",
    icon: "checkmark-done",
    color: Colors.success,
    screenshotName: "collector-06-report-cleanup-proof.png",
    actions: [
      "Open report detail and tap Clean after cleanup.",
      "Add cleanup note and photo evidence if available.",
      "Resident confirms or rejects cleanup from history.",
    ],
  },
  {
    id: "collector-profile",
    titleKey: "Profile, settings, and location save",
    subtitleKey: "Keep profile updated and save last location when logging out.",
    icon: "person-circle",
    color: Colors.primaryDark,
    screenshotName: "collector-07-profile-settings-logout-location.png",
    actions: [
      "Update collector profile phone and location area.",
      "Use settings for language, theme, and preferences.",
      "On logout, save last location when prompted.",
    ],
  },
];

export default function GuideScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { user } = useApp();

  const audience: GuideAudience = user?.role === "collector" ? "collector" : "resident";
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(null);

  const guideSteps = useMemo(
    () => (audience === "collector" ? COLLECTOR_GUIDE_STEPS : RESIDENT_GUIDE_STEPS),
    [audience]
  );

  const guideTitle = audience === "collector" ? t("Collector App Guide") : t("Resident App Guide");
  const guideSubtitle =
    audience === "collector"
      ? t("Learn how to manage assignments, routing, proofs, and issue handling.")
      : t("Learn how to use pickups, reports, tracking, rewards, and settings.");
  const screenshotFolder =
    audience === "collector" ? "assets/guide-screenshots/collector" : "assets/guide-screenshots/resident";

  const toggleSection = async (id: string) => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setExpandedSectionId((current) => (current === id ? null : id));
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
      contentInsetAdjustmentBehavior="automatic"
    >
      <View pointerEvents="none" style={styles.bgGlowBottom} />

      <View style={styles.header}>
        <AppText variant="title" style={styles.heading} color={colors.text}>
          {t("App Usage Guide")}
        </AppText>
        <AppText color={colors.textSecondary} style={styles.subtitle}>
          {guideSubtitle}
        </AppText>
      </View>

      <View style={[styles.titleWrap, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <AppText style={styles.title} color={colors.text}>
          {guideTitle}
        </AppText>
        <AppText variant="caption" color={colors.textSecondary} style={styles.titleHint}>
          {t("Tap each step to expand details.")}
        </AppText>
      </View>

      <View style={styles.content}>
        {guideSteps.map((step, index) => {
          const isExpanded = expandedSectionId === step.id;
          const collapseState = isExpanded ? t("collapse") : t("expand");
          return (
            <Pressable
              key={step.id}
              style={({ pressed }) => [
                styles.stepCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && !isExpanded && { opacity: 0.95 },
              ]}
              onPress={() => void toggleSection(step.id)}
            >
              <View style={styles.stepHeader}>
                <View style={[styles.stepIcon, { backgroundColor: step.color + "18" }]}>
                  <Ionicons name={step.icon} size={22} color={step.color} />
                </View>
                <View style={styles.stepTextWrap}>
                  <AppText
                    variant="overline"
                    style={[styles.stepNumber, { fontFamily: fonts.bold }]}
                    color={step.color}
                  >
                    {t("Step {number}", { number: index + 1 })}
                  </AppText>
                  <AppText style={styles.stepTitle} color={colors.text}>
                    {t(step.titleKey)}
                  </AppText>
                  <AppText variant="caption" color={colors.textSecondary}>
                    {t("Tap to {state}", { state: collapseState })}
                  </AppText>
                </View>
                <Ionicons
                  name={isExpanded ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={colors.textSecondary}
                />
              </View>

              {isExpanded ? (
                <View style={styles.stepBody}>
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  <AppText style={styles.stepSubtitle} color={colors.textSecondary}>
                    {t(step.subtitleKey)}
                  </AppText>

                  <View style={styles.actionList}>
                    {step.actions.map((action, actionIndex) => (
                      <View key={`${step.id}-${actionIndex}`} style={styles.actionRow}>
                        <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                        <AppText style={styles.actionText} color={colors.textSecondary}>
                          {t(action)}
                        </AppText>
                      </View>
                    ))}
                  </View>

                  <View style={[styles.screenshotBox, { borderColor: colors.border, backgroundColor: colors.background }]}>
                    <Ionicons name="image-outline" size={22} color={Colors.primary} />
                    <AppText style={styles.screenshotTitle} color={colors.text}>
                      {t("Screenshot Placeholder")}
                    </AppText>
                    <AppText variant="caption" color={colors.textSecondary} style={styles.screenshotMeta}>
                      {t("Screenshot file: {file}", { file: step.screenshotName })}
                    </AppText>
                    <AppText variant="caption" color={colors.textSecondary} style={styles.screenshotMeta}>
                      {t("Drop this file in: {path}", { path: `${screenshotFolder}/${step.screenshotName}` })}
                    </AppText>
                  </View>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.infoCard, { backgroundColor: Colors.primary + "10", borderColor: Colors.primary + "30" }]}>
        <View style={styles.infoHeader}>
          <Ionicons name="folder-open-outline" size={20} color={Colors.primary} />
          <AppText style={styles.infoTitle} color={Colors.primary}>
            {t("Screenshots folder ready")}
          </AppText>
        </View>
        <AppText style={styles.infoText} color={colors.text}>
          {t("Use the exact file names from GUIDE_SCREENSHOT_INSERTION.md and place them in the guide-screenshots folders.")}
        </AppText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bgGlowBottom: {
    position: "absolute",
    bottom: -140,
    left: -90,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(13,150,104,0.07)",
  },
  header: { paddingHorizontal: 20, paddingBottom: 10, gap: 2 },
  heading: { fontSize: 22 },
  subtitle: { fontSize: fontSizes.md, lineHeight: 20, marginTop: 4 },
  titleWrap: {
    marginHorizontal: 20,
    marginTop: 6,
    borderRadius: radius.xl,
    borderWidth: 1,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md,
  },
  title: { fontSize: fontSizes.button, fontFamily: fonts.bold },
  titleHint: { marginTop: 4 },
  content: { paddingHorizontal: 20, paddingTop: spacing.md, gap: 10 },
  stepCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  stepHeader: { flexDirection: "row", alignItems: "center", padding: spacing.md + 2 },
  stepIcon: { width: 44, height: 44, borderRadius: radius.lg, alignItems: "center", justifyContent: "center" },
  stepTextWrap: { flex: 1, marginLeft: 10 },
  stepNumber: { fontFamily: fonts.bold },
  stepTitle: { fontSize: fontSizes.body, fontFamily: fonts.semibold, lineHeight: 20, marginTop: 2 },
  stepBody: { paddingHorizontal: spacing.md + 2, paddingBottom: spacing.md + 2 },
  divider: { height: 1, marginBottom: 10 },
  stepSubtitle: { fontSize: fontSizes.sm, lineHeight: 19 },
  actionList: { marginTop: 10, gap: spacing.sm },
  actionRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  actionText: { flex: 1, fontSize: fontSizes.sm, lineHeight: 18 },
  screenshotBox: {
    marginTop: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    gap: spacing.xs,
  },
  screenshotTitle: { fontSize: fontSizes.sm, fontFamily: fonts.bold },
  screenshotMeta: { textAlign: "center", lineHeight: 17 },
  infoCard: {
    marginTop: spacing.lg,
    marginHorizontal: 20,
    borderRadius: radius.xl,
    borderWidth: 1,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md + 2,
  },
  infoHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  infoTitle: { fontSize: fontSizes.md, fontFamily: fonts.bold },
  infoText: { marginTop: spacing.sm, fontSize: fontSizes.sm, lineHeight: 19 },
});