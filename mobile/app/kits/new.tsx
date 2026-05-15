import { View, Text, StyleSheet } from "react-native";

export default function NewKitScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add Kit</Text>
      <Text style={styles.subtitle}>Sectioned form with image upload coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 8 },
  subtitle: { fontSize: 16, color: "#666" },
});
