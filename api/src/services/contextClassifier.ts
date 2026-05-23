import { prisma } from "../prisma";

export async function classifyActivity(
  appName: string,
  title: string
) {

  /* LAYER 1: STATIC RULES */

  const pattern = await findAppPattern(appName, title);

  if (pattern) return pattern;

  /* LAYER 2: DOMAIN INTELLIGENCE */

  const domain = extractDomain(title);

  if (domain) {

    const result = classifyDomain(domain);

    if (result) return result;

  }

  /* LAYER 3: FALLBACK */

  return {
    category: "research",
    intent: "reading",
    focusImpact: 0.5,
    energyImpact: 0,
    confidence: 0.3
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

  const patterns = await prisma.appPattern.findMany({
    where: { appName }
  });

  if (!patterns.length) return null;

  for (const pattern of patterns) {

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