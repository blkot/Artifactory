import React from "react";
import { View, Text, StyleSheet, ViewStyle, TextStyle } from "react-native";

interface MetricCardProps {
  label: string;
  value: string | number;
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

export default function MetricCard({ label, value }: MetricCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 15,
  } as ViewStyle,
  label: {
    fontSize: 14,
    color: colors.muted,
  } as TextStyle,
  value: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.ink,
    marginTop: 7,
  } as TextStyle,
});
