import React from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from "react-native";

type ButtonVariant = "primary" | "danger" | "ghost";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
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

export default function Button({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.base,
        variant === "primary" && styles.primary,
        variant === "danger" && styles.danger,
        variant === "ghost" && styles.ghost,
        isDisabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "ghost" ? colors.ink : "#ffffff"}
        />
      ) : (
        <Text
          style={[
            styles.text,
            variant === "ghost" && styles.ghostText,
            isDisabled && styles.disabledText,
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  } as ViewStyle,
  primary: {
    backgroundColor: "#2a2f34",
    borderWidth: 1,
    borderColor: "#2a2f34",
  } as ViewStyle,
  danger: {
    backgroundColor: colors.danger,
    borderWidth: 1,
    borderColor: colors.danger,
  } as ViewStyle,
  ghost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.line,
  } as ViewStyle,
  disabled: {
    opacity: 0.6,
  } as ViewStyle,
  text: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  } as TextStyle,
  ghostText: {
    color: colors.ink,
  } as TextStyle,
  disabledText: {
    opacity: 0.6,
  } as TextStyle,
});
