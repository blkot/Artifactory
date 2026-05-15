import { View, Text, StyleSheet } from "react-native";

export default function KitsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kit Inventory</Text>
      <Text style={styles.subtitle}>Search, filter, and browse coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 8 },
  subtitle: { fontSize: 16, color: "#666" },
});
