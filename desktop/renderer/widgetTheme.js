// Appearance for the desktop widget: the themes, accents and typefaces from
// the dashboard's Settings page (dashboard/lib/appearance.ts). The widget
// shows no categories, so palettes are not needed here.
// verifyWidgetRenderer.js checks these values against the dashboard so the
// two cannot drift. Loads as a plain script (window.SamaritanTheme) and as a
// CommonJS module for that check.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SamaritanTheme = api;
})(this, function () {
  const THEMES = {
    "samaritan-dark": {
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
        alert: "#d92b2b",
        ok: "#3ecf72",
        warn: "#e5a50a",
        info: "#4fa3f7",
      },
    },
    "samaritan-dim": {
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
        alert: "#e0484a",
        ok: "#4cc17a",
        warn: "#d9a23a",
        info: "#5b9ee8",
      },
    },
    "samaritan-light": {
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
        alert: "#c41e1e",
        ok: "#1a7f3c",
        warn: "#a86400",
        info: "#1f63c7",
      },
    },
  };

  const ACCENTS = {
    red: { dark: "#d92b2b", light: "#d92b2b" },
    amber: { dark: "#e5a50a", light: "#b07400" },
    cyan: { dark: "#22c7e8", light: "#0b7d99" },
    green: { dark: "#3ecf72", light: "#18843f" },
    violet: { dark: "#a78bfa", light: "#6d3fd6" },
    mono: { dark: "#f8f8ff", light: "#110a0a" },
  };

  // Family names are declared with @font-face in widget.css.
  const FONTS = {
    samaritan: { display: '"Samaritan Display", monospace', text: '"Samaritan Text", monospace' },
    "geist-mono": { display: '"Geist Mono", monospace', text: '"Geist Mono", monospace' },
    geist: { display: '"Geist", sans-serif', text: '"Geist", sans-serif' },
    system: { display: "system-ui, sans-serif", text: "system-ui, sans-serif" },
  };

  const DEFAULT_APPEARANCE = { theme: "samaritan-dark", accent: "red", font: "samaritan" };

  function pick(table, value, fallback) {
    return typeof value === "string" && Object.prototype.hasOwnProperty.call(table, value) ? value : fallback;
  }

  // Unknown or missing ids fall back to the defaults, as on the dashboard.
  function resolve(appearance) {
    const value = appearance && typeof appearance === "object" ? appearance : {};
    return {
      theme: pick(THEMES, value.theme, DEFAULT_APPEARANCE.theme),
      accent: pick(ACCENTS, value.accent, DEFAULT_APPEARANCE.accent),
      font: pick(FONTS, value.font, DEFAULT_APPEARANCE.font),
    };
  }

  function buildVars(appearance) {
    const chosen = resolve(appearance);
    const theme = THEMES[chosen.theme];
    const vars = {};
    Object.keys(theme.tokens).forEach((name) => {
      vars[`--sam-${name}`] = theme.tokens[name];
    });
    vars["--sam-accent"] = ACCENTS[chosen.accent][theme.mode];
    vars["--sam-font-display"] = FONTS[chosen.font].display;
    vars["--sam-font-text"] = FONTS[chosen.font].text;
    return { mode: theme.mode, vars };
  }

  function apply(appearance, element) {
    const target = element || document.documentElement;
    const { mode, vars } = buildVars(appearance);
    Object.keys(vars).forEach((name) => target.style.setProperty(name, vars[name]));
    target.style.colorScheme = mode;
    target.dataset.mode = mode;
  }

  return { THEMES, ACCENTS, FONTS, DEFAULT_APPEARANCE, resolve, buildVars, apply };
});
