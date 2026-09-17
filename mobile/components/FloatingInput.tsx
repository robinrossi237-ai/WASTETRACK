import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Colors from "@/constants/colors";
import { useTheme } from "@/lib/theme-context";

type FloatingInputType = "text" | "email" | "password" | "phone" | "search" | "number";

type FloatingInputProps = Omit<TextInputProps, "value" | "onChangeText" | "onChange"> & {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: FloatingInputType | "numeric";
  error?: string | null;
  required?: boolean;
  disabled?: boolean;
  success?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  rightAccessory?: React.ReactNode;
};

export default function FloatingInput({
  label,
  value,
  onChange,
  type = "text",
  error,
  required,
  disabled,
  success,
  icon,
  rightAccessory,
  style,
  editable,
  keyboardType,
  autoCapitalize,
  autoCorrect,
  spellCheck,
  secureTextEntry,
  multiline,
  numberOfLines,
  onFocus,
  onBlur,
  ...rest
}: FloatingInputProps) {
  const { colors } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [isSecure, setIsSecure] = useState(type === "password");
  const animated = useRef(new Animated.Value(value ? 1 : 0)).current;

  const hasValue = value && value.length > 0;
  const shouldFloat = isFocused || hasValue;

  useEffect(() => {
    Animated.timing(animated, {
      toValue: shouldFloat ? 1 : 0,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [animated, shouldFloat]);

  const labelColor = error
    ? Colors.error
    : success
      ? Colors.success
      : isFocused
        ? Colors.primary
        : colors.textSecondary;

  const borderColor = error
    ? Colors.error
    : success
      ? Colors.success
      : isFocused
        ? Colors.primary
        : colors.border;

  const computedKeyboardType = useMemo(() => {
    if (keyboardType) return keyboardType;
    if (type === "email") return "email-address";
    if (type === "phone") return "phone-pad";
    if (type === "number" || type === "numeric") return "numeric";
    return "default";
  }, [keyboardType, type]);

  const computedAutoCapitalize = useMemo(() => {
    if (autoCapitalize) return autoCapitalize;
    if (type === "email" || type === "password") return "none";
    return "sentences";
  }, [autoCapitalize, type]);

  const computedAutoCorrect = useMemo(() => {
    if (typeof autoCorrect === "boolean") return autoCorrect;
    if (type === "email" || type === "password") return false;
    return true;
  }, [autoCorrect, type]);

  const computedSpellCheck = useMemo(() => {
    if (typeof spellCheck === "boolean") return spellCheck;
    if (type === "email" || type === "password") return false;
    return true;
  }, [spellCheck, type]);

  const labelLeft = icon ? 48 : 16;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: colors.surface,
            borderColor,
            opacity: disabled ? 0.6 : 1,
          },
          multiline && styles.multilineWrapper,
        ]}
      >
        {icon ? (
          <View style={styles.iconWrap}>
            <Ionicons name={icon} size={18} color={labelColor} />
          </View>
        ) : null}

        <Animated.Text
          pointerEvents="none"
          style={[
            styles.label,
            {
              left: labelLeft,
              color: labelColor,
              backgroundColor: colors.surface,
              top: animated.interpolate({
                inputRange: [0, 1],
                outputRange: [18, 6],
              }),
              fontSize: animated.interpolate({
                inputRange: [0, 1],
                outputRange: [15, 12],
              }),
            },
          ]}
          numberOfLines={1}
        >
          {label}
          {required ? " *" : ""}
        </Animated.Text>

        <TextInput
          style={[styles.input, multiline && styles.multilineInput, style as any, { color: colors.text }]}
          value={value}
          onChangeText={onChange}
          editable={disabled ? false : editable ?? true}
          keyboardType={computedKeyboardType}
          autoCapitalize={computedAutoCapitalize}
          autoCorrect={computedAutoCorrect}
          spellCheck={computedSpellCheck}
          secureTextEntry={type === "password" ? isSecure : secureTextEntry}
          placeholder=""
          placeholderTextColor="transparent"
          onFocus={(event) => {
            setIsFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setIsFocused(false);
            onBlur?.(event);
          }}
          multiline={multiline}
          numberOfLines={numberOfLines}
          textAlignVertical={multiline ? "top" : "center"}
          {...rest}
        />

        {rightAccessory ? <View style={styles.accessoryWrap}>{rightAccessory}</View> : null}

        {type === "password" ? (
          <Pressable
            style={({ pressed }) => [styles.toggleButton, pressed && { opacity: 0.7 }]}
            onPress={() => setIsSecure((current) => !current)}
            hitSlop={8}
          >
            <Ionicons
              name={isSecure ? "eye-outline" : "eye-off-outline"}
              size={18}
              color={colors.textSecondary}
            />
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <Text style={[styles.errorText, { color: Colors.error }]}>{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%" },
  inputWrapper: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  multilineWrapper: {
    alignItems: "flex-start",
    paddingTop: 12,
    paddingBottom: 12,
  },
  label: {
    position: "absolute",
    paddingHorizontal: 4,
    zIndex: 2,
    fontFamily: "Inter_500Medium",
  },
  input: {
    flex: 1,
    paddingTop: 18,
    paddingBottom: 10,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  multilineInput: {
    minHeight: 120,
    paddingTop: 20,
    paddingBottom: 10,
  },
  iconWrap: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  accessoryWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  toggleButton: {
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  errorText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 6,
  },
});
