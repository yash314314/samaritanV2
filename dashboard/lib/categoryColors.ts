export const CATEGORY_COLORS: Record<string, string> = {
  deep_work: "#8b5cf6",
  research: "#533196",
  communication: "#06b6d4",
  productivity: "#22c55e",
  media: "#f59e0b",
  entertainment: "#ec4899",
  development_tools: "#6366f1",
  system: "#71717a",
  idle: "#3f3f46",
  unknown: "#94a3b8",
};

export function getCategoryColor(category?: string | null) {
  return CATEGORY_COLORS[category ?? "unknown"] ?? CATEGORY_COLORS.unknown;
}

export function formatCategory(category?: string | null) {
  return (category || "unknown").replaceAll("_", " ");
}
