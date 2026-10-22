import localFont from "next/font/local";

// The typefaces of Samaritan's interface in Person of Interest, the same pair
// the Samaritan lock screen uses: Magda Clean Mono for identity, headings and
// numerals; monoMMM_5 for everything that is read rather than seen.
export const samaritanDisplay = localFont({
  src: "./fonts/magdacleanmono-bold.ttf",
  weight: "700",
  variable: "--font-samaritan-display",
  display: "swap",
});

export const samaritanText = localFont({
  src: "./fonts/monoMMM_5.ttf",
  weight: "400",
  variable: "--font-samaritan-text",
  display: "swap",
});

// Optional faces from Appearance settings (Geist, SIL Open Font License 1.1).
// Not preloaded: the browser fetches them only once someone selects them.
export const geistSans = localFont({
  src: "./fonts/Geist-Variable.ttf",
  weight: "100 900",
  variable: "--font-geist-sans",
  display: "swap",
  preload: false,
});

export const geistMono = localFont({
  src: "./fonts/GeistMono-Variable.ttf",
  weight: "100 900",
  variable: "--font-geist-mono",
  display: "swap",
  preload: false,
});

export const fontVariables = [samaritanDisplay, samaritanText, geistSans, geistMono]
  .map((font) => font.variable)
  .join(" ");
