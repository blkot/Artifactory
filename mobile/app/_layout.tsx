import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
      <Stack.Screen name="kits/new" options={{ headerShown: true, title: "Add Kit" }} />
      <Stack.Screen name="kits/[id]/index" options={{ headerShown: true, title: "Kit Detail" }} />
      <Stack.Screen name="settings/filters" options={{ headerShown: true, title: "Filters" }} />
    </Stack>
  );
}
