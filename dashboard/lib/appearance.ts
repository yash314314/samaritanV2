// Appearance catalogue: themes, accents, category palettes and typefaces.
// Everything visual reads CSS custom properties; choosing an appearance only
// rewrites those properties on <html>, so the whole UI (charts included)
// restyles without re-rendering.

export type Mode = "dark" | "light";

export type ThemeDef = {
  label: string;
  description: string;
  mode: Mode;
  tokens: {
    void: string;
    signal: string;
    trace: string;
    key: string;
    dim: string;
    grid: string;
    track: string;
    raised: string;
    control: string;
    alert: string;
    ok: string;
    warn: string;
    info: string;
  };
};

export const THEMES = {
  "samaritan-dark": {
    label: "Samaritan",
    description: "Pure black with ghost-white type and clinical red alerts.",
    mode: "dark",
    tokens: {
      void: "#000000",
      signal: "#f8f8ff",
      trace: "#d6d6d6",
      key: "#9a9a9a",
      dim: "#5c5c5c",
      grid: "#262626",
      track: "#141414",
      raised: "#0a0a0a",
      control: "#3a3a3a",
      alert: "#fb0915",
      ok: "#f8f8ff",
      warn: "#fb0915",
      info: "#d6d6d6",
    },
  },
  "samaritan-dim": {
    label: "Dim",
    description: "Charcoal ground with soft white type and scarlet warnings.",
    mode: "dark",
    tokens: {
      void: "#0f0f11",
      signal: "#e4e4e9",
      trace: "#c2c2c9",
      key: "#8b8b94",
      dim: "#5a5a63",
      grid: "#28282e",
      track: "#1a1a1f",
      raised: "#16161a",
      control: "#3b3b43",
      alert: "#ef4444",
      ok: "#e4e4e9",
      warn: "#ef4444",
      info: "#c2c2c9",
    },
  },
  "samaritan-light": {
    label: "Samaritan Light",
    description: "White ground with near-black ink and high-contrast red.",
    mode: "light",
    tokens: {
      void: "#ffffff",
      signal: "#110a0a",
      trace: "#2b2525",
      key: "#6b6565",
      dim: "#9b9595",
      grid: "#e3e0e0",
      track: "#efeded",
      raised: "#f7f6f6",
      control: "#c9c4c4",
      alert: "#b91c1c",
      ok: "#110a0a",
      warn: "#b91c1c",
      info: "#2b2525",
    },
  },
} satisfies Record<string, ThemeDef>;

export type ThemeId = keyof typeof THEMES;

// The accent marks Samaritan's presence: strictly Red or Monochrome.
export const ACCENTS = {
  red: { label: "Red", dark: "#fb0915", light: "#b91c1c" },
  crimson: { label: "Crimson", dark: "#ef4444", light: "#991b1b" },
  mono: { label: "Monochrome", dark: "#f8f8ff", light: "#110a0a" },
  silver: { label: "Silver", dark: "#d6d6d6", light: "#2b2525" },
} satisfies Record<string, { label: string; dark: string; light: string }>;

export type AccentId = keyof typeof ACCENTS;

export const CATEGORIES = [
  "deep_work",
  "development_tools",
  "productivity",
  "research",
  "communication",
  "media",
  "entertainment",
  "system",
  "unknown",
  "idle",
] as const;

export type Category = (typeof CATEGORIES)[number];

type CategoryColors = Record<Category, string>;

// Samaritan UI: Strictly Black, White/Zinc, and Samaritan Red.
export const PALETTES = {
  monochrome: {
    label: "Monochrome & Red",
    description: "Brightness follows focus; restricted targets in Samaritan red.",
    dark: {
      deep_work: "#f8f8ff",
      development_tools: "#e4e4e9",
      productivity: "#c2c2c9",
      research: "#9a9a9a",
      communication: "#707070",
      media: "#991b1b",
      entertainment: "#fb0915",
      system: "#585858",
      unknown: "#404040",
      idle: "#262626",
    },
    light: {
      deep_work: "#110a0a",
      development_tools: "#2e2a2a",
      productivity: "#4d4848",
      research: "#6b6565",
      communication: "#8b8585",
      media: "#991b1b",
      entertainment: "#b91c1c",
      system: "#ababab",
      unknown: "#c4c4c4",
      idle: "#e8e8e8",
    },
    series: {
      dark: ["#f8f8ff", "#d6d6d6", "#9a9a9a", "#fb0915"],
      light: ["#110a0a", "#4d4848", "#8b8585", "#b91c1c"],
    },
  },
  spectrum: {
    label: "Samaritan Standard",
    description: "Standard Samaritan surveillance palette: signal whites and red alerts.",
    dark: {
      deep_work: "#f8f8ff",
      development_tools: "#e4e4e9",
      productivity: "#c2c2c9",
      research: "#9a9a9a",
      communication: "#707070",
      media: "#991b1b",
      entertainment: "#fb0915",
      system: "#585858",
      unknown: "#404040",
      idle: "#262626",
    },
    light: {
      deep_work: "#110a0a",
      development_tools: "#2e2a2a",
      productivity: "#4d4848",
      research: "#6b6565",
      communication: "#8b8585",
      media: "#991b1b",
      entertainment: "#b91c1c",
      system: "#ababab",
      unknown: "#c4c4c4",
      idle: "#e8e8e8",
    },
    series: {
      dark: ["#f8f8ff", "#d6d6d6", "#9a9a9a", "#fb0915"],
      light: ["#110a0a", "#4d4848", "#8b8585", "#b91c1c"],
    },
  },
} satisfies Record<
  string,
  {
    label: string;
    description: string;
    dark: CategoryColors;
    light: CategoryColors;
    // Chart series 2-5; series 1 is always the theme's signal ink.
    series: Record<Mode, [string, string, string, string]>;
  }
>;

export type PaletteId = keyof typeof PALETTES;

// Font variables come from next/font in app/fonts.ts.
export const FONTS = {
  samaritan: {
    label: "Samaritan",
    description: "Magda Clean Mono and monoMMM_5, the faces of Samaritan's interface.",
    display: "var(--font-samaritan-display)",
    text: "var(--font-samaritan-text)",
    displayWeight: "700",
  },
  "geist-mono": {
    label: "Geist Mono",
    description: "A precise, contemporary monospace.",
    display: "var(--font-geist-mono)",
    text: "var(--font-geist-mono)",
    displayWeight: "600",
  },
  geist: {
    label: "Geist",
    description: "A neutral sans-serif for easier long reading.",
    display: "var(--font-geist-sans)",
    text: "var(--font-geist-sans)",
    displayWeight: "600",
  },
  system: {
    label: "System",
    description: "Your operating system's interface font.",
    display: "system-ui, sans-serif",
    text: "system-ui, sans-serif",
    displayWeight: "600",
  },
} satisfies Record<string, { label: string; description: string; display: string; text: string; displayWeight: string }>;

export type FontId = keyof typeof FONTS;

export type Appearance = {
  theme: ThemeId;
  accent: AccentId;
  palette: PaletteId;
  font: FontId;
};

export const DEFAULT_APPEARANCE: Appearance = {
  theme: "samaritan-dark",
  accent: "red",
  palette: "spectrum",
  font: "samaritan",
};

export const APPEARANCE_STORAGE_KEY = "samaritan.appearance";

export const APPEARANCE_CATALOGUE = { THEMES, ACCENTS, PALETTES, FONTS, DEFAULT_APPEARANCE };

// Unknown or stale ids (from storage or the API) fall back to the default.
export function resolveAppearance(input: unknown): Appearance {
  const value = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const pick = <T extends string>(key: keyof Appearance, options: Record<string, unknown>) =>
    (typeof value[key] === "string" && (value[key] as string) in options ? value[key] : DEFAULT_APPEARANCE[key]) as T;
  return {
    theme: pick<ThemeId>("theme", THEMES),
    accent: pick<AccentId>("accent", ACCENTS),
    palette: pick<PaletteId>("palette", PALETTES),
    font: pick<FontId>("font", FONTS),
  };
}

/*
 * Builds the custom properties for one appearance. It is also serialised into
 * the pre-paint <head> script (see appearanceScript), so it must stay
 * self-contained: no imports, no closures over module state.
 */
export function buildAppearanceVars(
  appearance: Appearance,
  catalogue: typeof APPEARANCE_CATALOGUE
): { mode: Mode; vars: Record<string, string> } {
  const theme = catalogue.THEMES[appearance.theme] || catalogue.THEMES[catalogue.DEFAULT_APPEARANCE.theme];
  const mode = theme.mode;
  const accent = catalogue.ACCENTS[appearance.accent] || catalogue.ACCENTS[catalogue.DEFAULT_APPEARANCE.accent];
  const palette = catalogue.PALETTES[appearance.palette] || catalogue.PALETTES[catalogue.DEFAULT_APPEARANCE.palette];
  const font = catalogue.FONTS[appearance.font] || catalogue.FONTS[catalogue.DEFAULT_APPEARANCE.font];

  const vars: Record<string, string> = {};
  for (const [name, value] of Object.entries(theme.tokens)) vars[`--sam-${name}`] = value;
  vars["--sam-accent"] = accent[mode];
  for (const [name, value] of Object.entries(palette[mode])) vars[`--cat-${name}`] = value;
  palette.series[mode].forEach((value, index) => {
    vars[`--sam-series-${index + 2}`] = value;
  });
  vars["--sam-font-display"] = font.display;
  vars["--sam-font-text"] = font.text;
  vars["--sam-display-weight"] = font.displayWeight;
  return { mode, vars };
}

export function applyAppearance(appearance: Appearance) {
  const { mode, vars } = buildAppearanceVars(appearance, APPEARANCE_CATALOGUE);
  const root = document.documentElement;
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
  root.dataset.mode = mode;
  root.style.colorScheme = mode;
}

// Runs in <head> before first paint so a stored appearance never flashes the
// default theme.
export function appearanceScript() {
  return `(function(){try{var c=${JSON.stringify(APPEARANCE_CATALOGUE)};var b=${buildAppearanceVars.toString()};var a=c.DEFAULT_APPEARANCE;try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(APPEARANCE_STORAGE_KEY)})||"null");if(s&&typeof s==="object"){for(var k in a){if(typeof s[k]==="string")a[k]=s[k];}}}catch(e){}var r=b(a,c);var e=document.documentElement;for(var n in r.vars)e.style.setProperty(n,r.vars[n]);e.dataset.mode=r.mode;e.style.colorScheme=r.mode;}catch(e){}})();`;
}

export function categoryColor(category?: string | null) {
  const name = (CATEGORIES as readonly string[]).includes(category ?? "") ? category : "unknown";
  return `var(--cat-${name})`;
}
