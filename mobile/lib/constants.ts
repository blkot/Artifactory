export const GRADES = ["HG", "RG", "MG", "PG", "SD", "CUSTOM"];
export const BUILD_STATUS = ["NEW", "OPENED", "IN_PROGRESS", "COMPLETED"];
export const LINK_CATEGORIES = ["BUILD_LOG", "REVIEW", "TUTORIAL", "GALLERY"];
export const ASSET_TYPES = ["BOX_ART", "MANUAL", "BUILD_PHOTO", "REFERENCE_IMAGE", "VIDEO", "DOCUMENT"];
export const PAGE_SIZE = 10;
export const THUMBNAIL_PREF_STORAGE_KEY = "artifactory_kit_thumbnail_asset_map";
export const CUSTOM_FACET_STORAGE_KEY = "artifactory_custom_facet_values";

export const EMPTY_KIT_FILTERS = {
  q: "",
  grade: [],
  brand: [],
  series: [],
  build_status: [],
  scale: [],
  tag: [],
};

export const EMPTY_KIT_FORM: {
  name: string;
  grade: string;
  series: string;
  brand: string;
  scale: string;
  kit_number: string;
  purchase_date: string;
  purchase_price: string;
  purchase_shop: string;
  build_status: string;
  tag_ids: number[];
} = {
  name: "",
  grade: "HG",
  series: "",
  brand: "Bandai",
  scale: "1/144",
  kit_number: "",
  purchase_date: "",
  purchase_price: "",
  purchase_shop: "",
  build_status: "NEW",
  tag_ids: [],
};
