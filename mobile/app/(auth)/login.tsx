import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { api, setAuthToken } from "../../lib/api/client";

export default function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError("");
    setLoading(true);
    try {
      const result = await api.login(username, password);
      await setAuthToken(result.access_token);
      if (result.refresh_token) {
        await SecureStore.setItemAsync("artifactory_refresh_token", result.refresh_token);
      }
      router.replace("/(tabs)/dashboard");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>Artifactory</Text>
      <Text style={styles.heading}>Sign in</Text>
      <TextInput
        style={styles.input}
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity
        style={styles.button}
        onPress={handleLogin}
        disabled={loading}
      >
        <Text style={styles.buttonText}>{loading ? "Signing in..." : "Log In"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  brand: { textAlign: "center", fontSize: 14, color: "#c5672a", letterSpacing: 4, textTransform: "uppercase", fontWeight: "600" },
  heading: { textAlign: "center", fontSize: 28, fontWeight: "700", marginBottom: 16 },
  input: { borderWidth: 1, borderColor: "#d7d2c9", borderRadius: 10, padding: 14, fontSize: 16, backgroundColor: "#fff" },
  button: { backgroundColor: "#2a2f34", borderRadius: 10, padding: 14, alignItems: "center", marginTop: 8 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  error: { color: "#8d2b2b", textAlign: "center", fontSize: 14 },
});
