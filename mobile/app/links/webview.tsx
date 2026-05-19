import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ViewStyle,
  TextStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { WebView } from "react-native-webview";

const colors = {
  bg: "#f3efe8",
  surface: "#ffffff",
  ink: "#1b1d1f",
  muted: "#5f6870",
  line: "#d7d2c9",
  accent: "#c5672a",
};

export default function LinkWebViewScreen() {
  const { url, title } = useLocalSearchParams<{
    url?: string;
    title?: string;
  }>();

  const targetUrl = Array.isArray(url) ? url[0] : url;
  const pageTitle = Array.isArray(title) ? title[0] : title;

  if (!targetUrl) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Missing link URL.</Text>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={styles.actionText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.actionText}>{"‹ Back"}</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {pageTitle || "Link"}
        </Text>
        <TouchableOpacity
          onPress={() => Linking.openURL(targetUrl)}
          activeOpacity={0.7}
        >
          <Text style={styles.actionText}>Open</Text>
        </TouchableOpacity>
      </View>
      <WebView
        source={{ uri: targetUrl }}
        style={styles.webview}
        startInLoadingState
        setSupportMultipleWindows={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  } as ViewStyle,
  header: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.surface,
  } as ViewStyle,
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
    textAlign: "center",
  } as TextStyle,
  actionText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.accent,
  } as TextStyle,
  webview: {
    flex: 1,
    backgroundColor: colors.surface,
  } as ViewStyle,
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  } as ViewStyle,
  errorText: {
    fontSize: 15,
    color: colors.muted,
    textAlign: "center",
  } as TextStyle,
});
