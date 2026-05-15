import React from "react";
import {
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from "react-native";

interface TagProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
  color?: string;
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

export default function Tag({
  label,
  active = false,
  onPress,
  onRemove,
  color,
}: TagProps) {
  const content = (
    <View
      style={[
        styles.tag,
        active && styles.tagActive,
        onPress ? styles.tagPressable : null,
      ]}
    >
      {color ? (
        <View
          style={[
            styles.colorDot,
            { backgroundColor: color },
            active && styles.colorDotActive,
          ]}
        />
      ) : null}
      <Text style={[styles.label, active && styles.labelActive]}>
        {label}
      </Text>
      {onRemove ? (
        <TouchableOpacity
          onPress={onRemove}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          style={styles.removeBtn}
        >
          <Text
            style={[styles.removeText, active && styles.removeTextActive]}
          >
            {"×"}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  tag: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d0c7bb",
    backgroundColor: "#ede7de",
  } as ViewStyle,
  tagActive: {
    backgroundColor: "#2f3740",
    borderColor: "#2f3740",
  } as ViewStyle,
  tagPressable: {
    // no extra styling needed
  } as ViewStyle,
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  } as ViewStyle,
  colorDotActive: {
    borderColor: "rgba(255,255,255,0.2)",
  } as ViewStyle,
  label: {
    fontSize: 13,
    color: "#3e3b37",
  } as TextStyle,
  labelActive: {
    color: "#f9f2ea",
  } as TextStyle,
  removeBtn: {
    marginLeft: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.2)",
    alignItems: "center",
    justifyContent: "center",
  } as ViewStyle,
  removeText: {
    fontSize: 12,
    lineHeight: 13,
    color: "#3e3b37",
    fontWeight: "600",
  } as TextStyle,
  removeTextActive: {
    color: "#f9f2ea",
  } as TextStyle,
});
