import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(auth)/login" options={{ presentation: "modal" }} />
      <Stack.Screen name="kits/new" options={{ headerShown: true, title: "Add Kit" }} />
      <Stack.Screen name="kits/[id]" options={{ headerShown: true, title: "Kit Detail" }} />
      <Stack.Screen name="settings/filters" options={{ headerShown: true, title: "Filters" }} />
    </Stack>
  );
}
