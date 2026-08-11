import { formatCategory, getCategoryColor } from "@/lib/categoryColors";

type CategoryBreakdown = {
  name: string;
  duration?: number;
  minutes?: number;
  percentage?: number;
};

type TaggedApp = {
  category?: string | null;
  categories?: CategoryBreakdown[];
};

export default function AppCategoryTags({ app, limit = 2 }: { app: TaggedApp; limit?: number }) {
  const categories = app.categories?.length
    ? app.categories
    : [{ name: app.category ?? "unknown" }];

  return (
    <div className="mt-1 flex min-w-0 flex-wrap gap-1">
      {categories.slice(0, limit).map((category) => {
        const color = getCategoryColor(category.name);
        return (
          <span
            key={category.name}
            className="max-w-full truncate rounded px-1.5 py-0.5 text-[9px] font-medium capitalize leading-none"
            style={{
              color,
              backgroundColor: `${color}18`,
              border: `1px solid ${color}45`,
            }}
            title={category.percentage != null
              ? `${formatCategory(category.name)} ${category.percentage}% of this app's hour`
              : formatCategory(category.name)}
          >
            {formatCategory(category.name)}
          </span>
        );
      })}
    </div>
  );
}
