import React, { useState } from "react";
import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useTheme } from "@/lib/theme-context";

type BeforeAfterGalleryProps = {
  beforeUri?: string | null;
  afterUri?: string | null;
  beforeLabel: string;
  afterLabel: string;
};

export default function BeforeAfterGallery({
  beforeUri,
  afterUri,
  beforeLabel,
  afterLabel,
}: BeforeAfterGalleryProps) {
  const { colors } = useTheme();
  const [selected, setSelected] = useState<"before" | "after" | null>(null);

  const fullUri = selected === "before" ? beforeUri : selected === "after" ? afterUri : null;

  return (
    <View>
      <View style={[styles.row, { gap: 8 }]}>
        <Pressable
          style={({ pressed }) => [
            styles.frame,
            { borderColor: colors.border, backgroundColor: colors.background },
            pressed && { opacity: 0.85 },
          ]}
          onPress={() => {
            if (beforeUri) setSelected("before");
          }}
          disabled={!beforeUri}
        >
          {beforeUri ? (
            <Image source={{ uri: beforeUri }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={styles.placeholder}>
              <Ionicons name="image-outline" size={20} color={colors.textSecondary} />
            </View>
          )}
          <View style={[styles.caption, { backgroundColor: colors.surfaceSecondary ?? "#00000055" }]}>
            <Text style={[styles.captionText, { color: colors.text }]}>{beforeLabel}</Text>
          </View>
        </Pressable>

        <View style={styles.arrow}>
          <Ionicons name="arrow-forward" size={18} color={colors.textSecondary} />
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.frame,
            { borderColor: colors.border, backgroundColor: colors.background },
            pressed && { opacity: 0.85 },
          ]}
          onPress={() => {
            if (afterUri) setSelected("after");
          }}
          disabled={!afterUri}
        >
          {afterUri ? (
            <Image source={{ uri: afterUri }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={styles.placeholder}>
              <Ionicons name="image-outline" size={20} color={colors.textSecondary} />
            </View>
          )}
          <View style={[styles.caption, { backgroundColor: Colors.success + "22" }]}>
            <Text style={[styles.captionText, { color: colors.text }]}>{afterLabel}</Text>
          </View>
        </Pressable>
      </View>

      <Modal
        visible={!!fullUri}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <Pressable
          style={styles.lightboxBackdrop}
          onPress={() => setSelected(null)}
        >
          <Pressable style={styles.lightboxClose} onPress={() => setSelected(null)}>
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
          {fullUri ? (
            <Image source={{ uri: fullUri }} style={styles.lightboxImage} resizeMode="contain" />
          ) : null}
          <Text style={styles.lightboxCaption}>
            {selected === "before" ? beforeLabel : afterLabel}
          </Text>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  frame: {
    flex: 1,
    height: 130,
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  caption: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  captionText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  arrow: {
    paddingHorizontal: 2,
  },
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  lightboxClose: {
    position: "absolute",
    top: 50,
    right: 24,
    zIndex: 10,
    padding: 8,
  },
  lightboxImage: {
    width: "90%",
    height: "70%",
  },
  lightboxCaption: {
    marginTop: 16,
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
