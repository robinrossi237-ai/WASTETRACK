import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import Colors from "@/constants/colors";
import { useLanguage } from "@/lib/language-context";
import { useTheme } from "@/lib/theme-context";

const pad = (value: number) => String(value).padStart(2, "0");

const toIsoDate = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const TIME_SLOTS = Array.from({ length: 16 }, (_, index) => {
  const hour = index + 6;
  return `${pad(hour)}:00`;
});

type ReschedulePickupModalProps = {
  visible: boolean;
  initialDate?: string;
  initialTime?: string;
  onClose: () => void;
  onSave: (payload: { date: string; time: string; iso: string }) => Promise<void> | void;
};

export default function ReschedulePickupModal({
  visible,
  initialDate,
  initialTime,
  onClose,
  onSave,
}: ReschedulePickupModalProps) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [saving, setSaving] = useState(false);

  const dateOptions = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, offset) => {
      const date = new Date(today);
      date.setDate(today.getDate() + offset);
      return {
        value: toIsoDate(date),
        label: date.toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        }),
      };
    });
  }, []);

  useEffect(() => {
    if (!visible) return;
    const fallbackDate = dateOptions[0]?.value ?? toIsoDate(new Date());
    setSelectedDate(initialDate || fallbackDate);
    setSelectedTime(initialTime || "09:00");
    setSaving(false);
  }, [dateOptions, initialDate, initialTime, visible]);

  const handleSave = async () => {
    if (!selectedDate || !selectedTime) return;
    const parsed = new Date(`${selectedDate}T${selectedTime}`);
    if (Number.isNaN(parsed.getTime())) return;
    setSaving(true);
    try {
      await onSave({ date: selectedDate, time: selectedTime, iso: parsed.toISOString() });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>{t("Reschedule pickup")}</Text>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            {t("Pick a new date and time for your pickup.")}
          </Text>

          <Text style={[styles.label, { color: colors.textSecondary }]}>{t("Select date")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionRow}>
            {dateOptions.map((item) => {
              const selected = selectedDate === item.value;
              return (
                <Pressable
                  key={item.value}
                  style={({ pressed }) => [
                    styles.optionChip,
                    {
                      borderColor: selected ? Colors.primary : colors.border,
                      backgroundColor: selected ? Colors.primary + "16" : colors.surface,
                    },
                    pressed && { opacity: 0.86 },
                  ]}
                  onPress={() => setSelectedDate(item.value)}
                >
                  <Text style={[styles.optionText, { color: selected ? Colors.primary : colors.text }]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={[styles.label, { color: colors.textSecondary }]}>{t("Select time")}</Text>
          <View style={styles.timeGrid}>
            {TIME_SLOTS.map((slot) => {
              const selected = selectedTime === slot;
              return (
                <Pressable
                  key={slot}
                  style={({ pressed }) => [
                    styles.timeChip,
                    {
                      borderColor: selected ? Colors.primary : colors.border,
                      backgroundColor: selected ? Colors.primary + "16" : colors.surface,
                    },
                    pressed && { opacity: 0.86 },
                  ]}
                  onPress={() => setSelectedTime(slot)}
                >
                  <Text style={[styles.optionText, { color: selected ? Colors.primary : colors.text }]}>
                    {slot}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.actionsRow}>
            <Pressable onPress={onClose} disabled={saving}>
              <Text style={[styles.actionText, { color: colors.textSecondary }]}>{t("Cancel")}</Text>
            </Pressable>
            <Pressable onPress={() => void handleSave()} disabled={saving}>
              <Text style={[styles.actionText, { color: Colors.primary }]}>
                {saving ? t("Saving...") : t("Save")}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  hint: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 6, marginBottom: 12 },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 8 },
  optionRow: { gap: 8, paddingBottom: 10 },
  optionChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  optionText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  timeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 6 },
  timeChip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  actionsRow: { flexDirection: "row", justifyContent: "flex-end", gap: 16, marginTop: 12 },
  actionText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});

