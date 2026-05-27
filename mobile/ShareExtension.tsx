import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button, StyleSheet } from "react-native";
import {
  close,
  openHostApp,
  Text,
  View,
} from "expo-share-extension";
import type { InitialProps } from "expo-share-extension";

function sharedPayload({ text, url, files, images, videos }: InitialProps): string {
  const parts = [text, url, ...(files ?? []), ...(images ?? []), ...(videos ?? [])]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
  return Array.from(new Set(parts)).join(" ");
}

export default function ShareExtension(props: InitialProps) {
  const [didOpen, setDidOpen] = useState(false);
  const payload = useMemo(
    () => sharedPayload(props),
    [props.files, props.images, props.text, props.url, props.videos],
  );

  const openImporter = useCallback(() => {
    if (!payload) return;
    setDidOpen(true);
    openHostApp(`links/import?sharedText=${encodeURIComponent(payload)}`);
  }, [payload]);

  useEffect(() => {
    openImporter();
  }, [openImporter]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Save to Artifactory</Text>
      <Text style={styles.body} numberOfLines={3}>
        {payload || "No URL or text was shared."}
      </Text>
      <View style={styles.actions}>
        <Button
          title={didOpen ? "Open Again" : "Open Artifactory"}
          onPress={openImporter}
          disabled={!payload}
        />
        <Button title="Cancel" onPress={close} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 18,
    gap: 12,
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1b1d1f",
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: "#5f6870",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
});
