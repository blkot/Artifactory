import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { loadTokenFromStorage, setAuthToken } from "../lib/api/client";

const REFRESH_TOKEN_KEY = "artifactory_refresh_token";

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadTokenFromStorage().then(() => setReady(true));
  }, []);

  // Listen for auth expiry events (triggered by silent refresh failure)
  useEffect(() => {
    const onExpired = () => {
      setAuthToken(null);
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    };
    // In a real app, use an event emitter; for now, the API client handles it
    return () => {};
  }, []);

  if (!ready) return null;

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="(auth)/login"
        options={{ headerShown: false, presentation: "modal" }}
      />
      <Stack.Screen
        name="kits/new"
        options={{ title: "Add Kit" }}
      />
      <Stack.Screen
        name="kits/[id]/index"
        options={{ title: "Kit Workspace" }}
      />
      <Stack.Screen
        name="settings/filters"
        options={{ title: "Filter Management" }}
      />
    </Stack>
  );
}
