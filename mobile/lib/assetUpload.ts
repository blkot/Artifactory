import { Alert, Linking } from "react-native";
import * as ImagePicker from "expo-image-picker";

export const LOCAL_IMAGE_ASSET_TYPES = [
  "BUILD_PHOTO",
  "REFERENCE_IMAGE",
  "BOX_ART",
  "MANUAL",
];

async function ensureCameraPermission(): Promise<boolean> {
  let permission = await ImagePicker.getCameraPermissionsAsync();
  if (!permission.granted) {
    permission = await ImagePicker.requestCameraPermissionsAsync();
  }

  if (permission.granted) return true;

  Alert.alert(
    "Camera access needed",
    "Allow camera access to take photos and save them as kit assets.",
    [
      { text: "Cancel", style: "cancel" },
      { text: "Settings", onPress: () => Linking.openSettings() },
    ]
  );
  return false;
}

export async function takeAssetPhoto(): Promise<ImagePicker.ImagePickerAsset | null> {
  const canUseCamera = await ensureCameraPermission();
  if (!canUseCamera) return null;

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: 0.85,
    exif: false,
  });

  if (result.canceled) return null;
  return result.assets[0] ?? null;
}

function pickedImageName(
  asset: ImagePicker.ImagePickerAsset,
  fallbackPrefix: string
): string {
  if (asset.fileName) return asset.fileName;
  const extension = asset.mimeType?.split("/")[1] || "jpg";
  return `${fallbackPrefix}_${Date.now()}.${extension}`;
}

export function buildLocalImageAssetFormData({
  kitId,
  type,
  asset,
  description,
  fallbackPrefix = "image",
}: {
  kitId: number;
  type: string;
  asset: ImagePicker.ImagePickerAsset;
  description?: string;
  fallbackPrefix?: string;
}): FormData {
  const formData = new FormData();
  formData.append("kit_id", String(kitId));
  formData.append("type", type);
  if (description?.trim()) {
    formData.append("description", description.trim());
  }
  formData.append("file", {
    uri: asset.uri,
    name: pickedImageName(asset, fallbackPrefix),
    type: asset.mimeType || "image/jpeg",
  } as any);
  return formData;
}
