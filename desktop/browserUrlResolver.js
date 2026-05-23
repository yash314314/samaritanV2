function extractDomain(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      return null;
    }
  }
  
  function isBrowserApp(appName) {
    const name = (appName || "").toLowerCase();
  
    return (
      name.includes("chrome") ||
      name.includes("edge") ||
      name.includes("brave") ||
      name.includes("firefox") ||
      name.includes("browser")
    );
  }
  
  function isLikelyRealDomain(value) {
    if (!value) return false;
  
    const domain = value.toLowerCase().trim();
  
    if (domain === "localhost") return true;
    if (domain.startsWith("localhost:")) return true;
    if (domain.startsWith("127.")) return true;
  
    if (!domain.includes(".")) return false;
  
    const blockedExtensions = [
      ".png",
      ".jpg",
      ".jpeg",
      ".webp",
      ".gif",
      ".svg",
      ".ico",
      ".pdf",
      ".mp4",
      ".mkv",
      ".mp3",
      ".zip",
      ".rar"
    ];
  
    if (blockedExtensions.some((ext) => domain.endsWith(ext))) {
      return false;
    }
  
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(domain);
  }
  
  function inferUrlFromTitle(title) {
    const text = title || "";
  
    const localhost = text.match(/localhost:\d+/i);
    if (localhost) {
      return `http://${localhost[0]}`;
    }
  
    const matches =
      text.match(/([a-z0-9-]+\.)+[a-z]{2,}/gi) || [];
  
    const domain = matches.find(isLikelyRealDomain);
  
    if (!domain) return null;
  
    return `https://${domain}`;
  }
  
  async function resolveBrowserContext({ appName, title }) {
    if (!isBrowserApp(appName)) {
      return {
        url: null,
        domain: null
      };
    }
  
    const url = inferUrlFromTitle(title);
    const domain = extractDomain(url);
  
    return {
      url,
      domain
    };
  }
  
  module.exports = {
    isBrowserApp,
    resolveBrowserContext
  };