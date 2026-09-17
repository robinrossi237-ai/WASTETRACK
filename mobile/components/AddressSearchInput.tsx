import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Colors from "@/constants/colors";
import { useTheme } from "@/lib/theme-context";
import FloatingInput from "@/components/FloatingInput";
import {
  searchAddress,
  type AddressSuggestion,
} from "@/lib/address-search";

type AddressSearchInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSelect?: (suggestion: AddressSuggestion) => void;
  icon?: keyof typeof Ionicons.glyphMap;
  error?: string | null;
  required?: boolean;
  rightAccessory?: React.ReactNode;
  minChars?: number;
  debounceMs?: number;
  autoClearOnSelect?: boolean;
};

const AddressSearchInput = ({
  label,
  value,
  onChange,
  onSelect,
  icon,
  error,
  required,
  rightAccessory,
  minChars = 3,
  debounceMs = 400,
  autoClearOnSelect = true,
}: AddressSearchInputProps) => {
  const { colors } = useTheme();
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRequest = useRef<number>(0);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = value.trim();
    if (trimmed.length < minChars || !focused) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const requestId = ++activeRequest.current;
      try {
        const results = await searchAddress(trimmed);
        if (requestId !== activeRequest.current) return;
        setSuggestions(results);
      } catch {
        if (requestId !== activeRequest.current) return;
        setSuggestions([]);
      } finally {
        if (requestId === activeRequest.current) setLoading(false);
      }
    }, debounceMs);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, focused, minChars, debounceMs]);

  const handleSelect = (suggestion: AddressSuggestion) => {
    onChange(suggestion.label);
    setSuggestions([]);
    setFocused(false);
    onSelect?.(suggestion);
  };

  const showDropdown = focused && suggestions.length > 0;

  return (
    <View>
      <FloatingInput
        label={label}
        value={value}
        onChange={onChange}
        icon={icon}
        error={error}
        required={required}
        rightAccessory={
          <View style={styles.accessoryRow}>
            {loading ? (
              <ActivityIndicator size="small" color={Colors.primary} style={{ paddingHorizontal: 6 }} />
            ) : null}
            {rightAccessory}
          </View>
        }
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setTimeout(() => setFocused(false), 200);
        }}
        autoCapitalize="sentences"
        autoCorrect={false}
      />

      {showDropdown ? (
        <View style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {suggestions.map((suggestion) => (
            <Pressable
              key={suggestion.id}
              style={({ pressed }) => [
                styles.item,
                pressed && { backgroundColor: colors.surfaceSecondary },
              ]}
              onPress={() => handleSelect(suggestion)}
            >
              <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.itemText, { color: colors.text }]} numberOfLines={2}>
                {suggestion.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  accessoryRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  dropdown: {
    position: "absolute",
    top: 56,
    left: 0,
    right: 0,
    zIndex: 60,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 2,
    maxHeight: 240,
    overflow: "hidden",
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  itemText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
});

export default AddressSearchInput;
