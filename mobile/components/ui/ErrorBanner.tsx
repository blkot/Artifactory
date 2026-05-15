import React from "react";
import { Text, StyleSheet, TextStyle } from "react-native";

interface ErrorBannerProps {
  message: string;
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

export default function ErrorBanner({ message }: ErrorBannerProps) {
  if (!message) return null;

  return <Text style={styles.banner}>{message}</Text>;
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: "#ffe7e7",
    borderWidth: 1,
    borderColor: "#f3b9b9",
    color: "#842121",
    borderRadius: 10,
    padding: 11,
    fontSize: 14,
    overflow: "hidden",
  } as TextStyle,
});
