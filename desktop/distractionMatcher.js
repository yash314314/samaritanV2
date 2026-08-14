function normalize(value) {
  return String(value || "").toLowerCase().trim();
}

function normalizeApp(value) {
  return normalize(value).replace(/\.exe$/i, "").replace(/\s+/g, " ");
}

function normalizeDomain(value) {
  const raw = normalize(value);
  if (!raw) return "";
  try {
    const parsed = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return parsed.hostname.replace(/^www\./, "").replace(/\.$/, "");
  } catch {
    return raw.replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "").replace(/\.$/, "");
  }
}

function appMatches(target, appName) {
  const rule = normalizeApp(target);
  const app = normalizeApp(appName);
  return Boolean(rule && app && (app === rule || app.includes(rule)));
}

function domainMatches(target, domainOrUrl) {
  const rule = normalizeDomain(target);
  const domain = normalizeDomain(domainOrUrl);
  return Boolean(rule && domain && (domain === rule || domain.endsWith(`.${rule}`)));
}

function findMatchingDistractionRule(rules, context, focusActive) {
  return (rules || []).find((rule) => {
    if (!rule?.active) return false;
    if (rule.scope === "during_focus" && !focusActive) return false;
    if (rule.targetType === "app") {
      return appMatches(rule.normalizedTarget || rule.target, context.app);
    }
    if (rule.targetType === "domain") {
      return domainMatches(rule.normalizedTarget || rule.target, context.domain || context.url);
    }
    return false;
  }) || null;
}

module.exports = {
  appMatches,
  domainMatches,
  findMatchingDistractionRule,
  normalizeApp,
  normalizeDomain,
};
