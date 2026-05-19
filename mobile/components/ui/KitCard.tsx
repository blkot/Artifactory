import React from "react";
import {
  TouchableOpacity,
  View,
  Text,
  Image,
  StyleSheet,
  ImageStyle,
  ViewStyle,
  TextStyle,
} from "react-native";
import { authenticatedImageSource } from "../../lib/api/client";

interface KitLike {
  id?: number;
  name?: string;
  grade?: string;
  series?: string;
  brand?: string;
  scale?: string;
  kit_number?: string;
  purchase_date?: string;
  purchase_price?: number | string | null;
  purchase_shop?: string;
  build_status?: string;
}

interface KitCardProps {
  kit: KitLike;
  previewUrl?: string;
  onPress?: () => void;
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

function formatPrice(price: number | string | null | undefined): string | null {
  if (price === null || price === undefined || price === "") return null;
  const num = typeof price === "string" ? parseFloat(price) : price;
  if (isNaN(num) || num <= 0) return null;
  return `¥${num.toFixed(2)}`;
}

export default function KitCard({ kit, previewUrl, onPress }: KitCardProps) {
  const price = formatPrice(kit.purchase_price);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={!onPress}
    >
      {/* Media */}
      <View style={styles.media}>
        {previewUrl ? (
          <Image
            source={authenticatedImageSource(previewUrl)}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.gradeText}>
              {kit.grade || "?"}
            </Text>
          </View>
        )}
      </View>

      {/* Body */}
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>
          {kit.name || "Untitled"}
        </Text>
        {kit.series ? (
          <Text style={styles.series} numberOfLines={1}>
            {kit.series}
          </Text>
        ) : null}

        {/* Meta chips */}
        <View style={styles.meta}>
          {kit.grade ? (
            <View style={styles.chip}>
              <Text style={styles.chipText}>{kit.grade}</Text>
            </View>
          ) : null}
          {kit.build_status ? (
            <View style={styles.chip}>
              <Text style={styles.chipText}>
                {kit.build_status.replace("BuildStatus.", "").replace(/_/g, " ")}
              </Text>
            </View>
          ) : null}
          {kit.scale ? (
            <View style={styles.chip}>
              <Text style={styles.chipText}>{kit.scale}</Text>
            </View>
          ) : null}
        </View>

        {price ? (
          <Text style={styles.price}>{price}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    overflow: "hidden",
  } as ViewStyle,
  media: {
    aspectRatio: 4 / 3,
    backgroundColor: "#ece3d7",
  } as ViewStyle,
  thumbnail: {
    width: "100%",
    height: "100%",
  } as ImageStyle,
  placeholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3a434b",
  } as ViewStyle,
  gradeText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff7ef",
    letterSpacing: 0.5,
  } as TextStyle,
  body: {
    padding: 12,
  } as ViewStyle,
  name: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
  } as TextStyle,
  series: {
    fontSize: 14,
    color: colors.muted,
    marginTop: 3,
  } as TextStyle,
  meta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 10,
  } as ViewStyle,
  chip: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d8d0c4",
  } as ViewStyle,
  chipText: {
    fontSize: 12,
    color: "#4f575e",
  } as TextStyle,
  price: {
    fontSize: 15,
    color: colors.ink,
    marginTop: 10,
    fontWeight: "500",
  } as TextStyle,
});
