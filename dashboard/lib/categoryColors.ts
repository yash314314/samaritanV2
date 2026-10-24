import { CATEGORIES, categoryColor } from "./appearance";

// Category colours come from the palette chosen in Appearance settings; each
// entry is a CSS variable, usable in inline styles and SVG fill/stroke.
export const CATEGORY_COLORS: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((category) => [category, categoryColor(category)])
);

export function getCategoryColor(category?: string | null) {
  return categoryColor(category);
}

export function formatCategory(category?: string | null) {
  return (category || "unknown").replaceAll("_", " ");
}
