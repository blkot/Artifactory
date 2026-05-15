import React from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from "react-native";

type InputType = "text" | "number" | "date";

interface InputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  multiline?: boolean;
  type?: InputType;
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

export default function Input({
  label,
  value,
  onChangeText,
  placeholder,
  required = false,
  error,
  multiline = false,
  type = "text",
}: InputProps) {
  const keyboardType =
    type === "number" ? "numeric" : type === "date" ? "default" : "default";

  return (
    <View style={styles.wrapper}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={styles.required}> *</Text> : null}
        </Text>
      ) : null}
      <TextInput
        style={[
          styles.input,
          multiline && styles.multiline,
          error ? styles.inputError : null,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 4,
  } as ViewStyle,
  label: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: "500",
    marginBottom: 4,
  } as TextStyle,
  required: {
    color: colors.danger,
  } as TextStyle,
  input: {
    borderWidth: 1,
    borderColor: "#b9b2a7",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: "#ffffff",
  } as TextStyle,
  multiline: {
    minHeight: 80,
    paddingTop: 10,
  } as TextStyle,
  inputError: {
    borderColor: colors.danger,
    backgroundColor: "#fff5f5",
  } as TextStyle,
  error: {
    fontSize: 12,
    color: colors.danger,
    fontWeight: "500",
    marginTop: 4,
  } as TextStyle,
});
