import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from "react-native";

interface SortValue {
  sort: string;
  order: "asc" | "desc";
}

interface SortToggleProps {
  value: SortValue;
  onChange: (value: SortValue) => void;
}

const colors = {
  bg: "#f3efe8",
  surface: "#ffffff",
  ink: "#1b1d1f",
  muted: "#5f6870",
  line: "#d7d2c9",
  accent: "#c5672a",
  danger: "#8d2b2b",
};

export default function SortToggle({ value, onChange }: SortToggleProps) {
  const isNewest = value.order === "desc";

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={[styles.btn, isNewest && styles.btnActive]}
        onPress={() =>
          onChange({ sort: "activity_at", order: "desc" })
        }
        activeOpacity={0.7}
      >
        <Text style={[styles.btnText, isNewest && styles.btnTextActive]}>
          Recent
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.btn, !isNewest && styles.btnActive]}
        onPress={() =>
          onChange({ sort: "activity_at", order: "asc" })
        }
        activeOpacity={0.7}
      >
        <Text style={[styles.btnText, !isNewest && styles.btnTextActive]}>
          Oldest
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 4,
  } as ViewStyle,
  btn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "rgba(255,255,255,0.5)",
  } as ViewStyle,
  btnActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  } as ViewStyle,
  btnText: {
    fontSize: 13,
    color: colors.muted,
  } as TextStyle,
  btnTextActive: {
    color: "#fff9f2",
  } as TextStyle,
});
