import { prisma } from "../prisma";

export async function classifyActivity(
  appName: string,
  title: string,
  domainOrUrl?: string | null
) {

  /* LAYER 1: STATIC RULES */

  const pattern = await findAppPattern(appName, title);

  if (pattern) return pattern;

  /* LAYER 2: DOMAIN INTELLIGENCE */

  const domain = extractDomain([domainOrUrl, title].filter(Boolean).join(" "));

  if (domain) {

    const result = classifyDomain(domain);

    if (result) return result;

  }

  /* LAYER 3: FALLBACK */

  return {
    category: "unknown",
    intent: "unknown",
    focusImpact: 0.25,
    energyImpact: 0,
    confidence: 0.2
  };

}
function extractDomain(title: string) {

  const domains = [
    "github",
    "stackoverflow",
    "youtube",
    "gmail",
    "docs",
    "notion",
    "reddit",
    "arxiv",
    "medium",
    "openai"
  ];

  for (const d of domains) {
    if (title.toLowerCase().includes(d)) {
      return d;
    }
  }

  return null;

}
function classifyDomain(domain:string){

  switch(domain){

    case "github":
      return {
        category: "deep_work",
        intent: "coding",
        focusImpact: 0.9,
        energyImpact: 0,
        confidence: 0.8
      };

    case "stackoverflow":
      return {
        category: "research",
        intent: "debugging",
        focusImpact: 0.7,
        energyImpact: 0,
        confidence: 0.7
      };

    case "docs":
      return {
        category: "research",
        intent: "documentation",
        focusImpact: 0.7,
        energyImpact: 0,
        confidence: 0.7
      };

    case "youtube":
      return {
        category: "entertainment",
        intent: "video",
        focusImpact: 0.1,
        energyImpact: 0.2,
        confidence: 0.6
      };

    case "gmail":
      return {
        category: "communication",
        intent: "email",
        focusImpact: 0.4,
        energyImpact: 0,
        confidence: 0.7
      };

    default:
      return null;

  }

}


export async function findAppPattern(
  appName: string,
  windowTitle: string
) {

  const patterns = await prisma.appPattern.findMany();

  if (!patterns.length) return null;

  const appAliases = getAppAliases(appName);
  const sortedPatterns = patterns
    .filter((pattern) => appAliases.has(normalizeAppName(pattern.appName)))
    .sort((a, b) => specificityScore(b.titleRegex) - specificityScore(a.titleRegex));

  for (const pattern of sortedPatterns) {

    try {

      const regex = new RegExp(pattern.titleRegex, "i");

      if (regex.test(windowTitle)) {

        return {
          category: pattern.category,
          intent: pattern.intent,
          focusImpact: pattern.focusImpact,
          energyImpact: pattern.energyImpact,
          confidence: pattern.confidence
        };

      }

    } catch (err) {
      console.warn("Invalid regex:", pattern.titleRegex);
    }

  }

  return null;

}

function normalizeAppName(value: string) {
  return value
    .toLowerCase()
    .replace(/\.exe$/i, "")
    .replace(/\s+browser$/i, "")
    .replace(/^microsoft\s+/, "")
    .replace(/^google\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getAppAliases(appName: string) {
  const normalized = normalizeAppName(appName);
  const aliases = new Set([normalized]);

  const aliasGroups = [
    ["chrome", "google chrome", "chromium"],
    ["msedge", "edge", "microsoft edge"],
    ["brave", "brave browser"],
    ["code", "vs code", "visual studio code", "microsoft visual studio code"],
    ["cursor", "cursor editor"],
    ["whatsapp", "whatsapp desktop"],
    ["discord", "discord desktop"],
    ["telegram", "telegram desktop"],
    ["vlc", "vlc media player"],
    ["explorer", "file explorer", "windows explorer"],
    ["system idle", "idle"],
    ["avast secure", "avast secure browser"],
  ];

  for (const group of aliasGroups) {
    const normalizedGroup = group.map(normalizeAppName);
    if (normalizedGroup.some((alias) => alias === normalized || normalized.includes(alias) || alias.includes(normalized))) {
      normalizedGroup.forEach((alias) => aliases.add(alias));
    }
  }

  return aliases;
}

function specificityScore(titleRegex: string) {
  return titleRegex === ".*" ? 0 : titleRegex.length;
}
