const browserApps = [
    "chrome",
    "edge",
    "brave",
    "firefox",
    "avast secure browser"
  ];
  
  const appIconMap: Record<string, string> = {
    brave: "/icons/apps/brave.png",
    "brave browser": "/icons/apps/brave.png",
  
    edge: "/icons/apps/edge.png",
    "microsoft edge": "/icons/apps/edge.png",
  
    chrome: "/icons/apps/chrome.png",
    "google chrome": "/icons/apps/chrome.png",
  
    cursor: "/icons/apps/cursor.png",
    spotify: "/icons/apps/spotify.png",
    codex: "/icons/apps/codex.png",
    whatsapp: "/icons/apps/whatsapp.png",
    "whatsapp.root": "/icons/apps/whatsapp.png",
    "visual studio code": "/icons/apps/vscode.png"
  };
  
  function normalize(value: string) {
    return value.toLowerCase().trim();
  }
  
  function isRealWebDomain(domain?: string | null) {
    if (!domain) return false;
  
    const value = domain.toLowerCase();
  
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
  
    if (blockedExtensions.some(ext => value.endsWith(ext))) {
      return false;
    }
  
    return (
      value !== "localhost" &&
      !value.startsWith("localhost") &&
      !value.startsWith("127.") &&
      value.includes(".")
    );
  }
  
  export function getDomainFromUrl(url?: string | null) {
    if (!url) return null;
  
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return null;
    }
  }
  
  export function resolveActivityIcon(input: {
    appName: string;
    url?: string | null;
    domain?: string | null;
  }) {
    const appName = normalize(input.appName);
    const domain = input.domain ?? getDomainFromUrl(input.url);
  
    const matchedApp = Object.keys(appIconMap).find(key =>
      appName.includes(key)
    );
  
    const appIconUrl = matchedApp ? appIconMap[matchedApp] : null;
  
    const isBrowser = browserApps.some(browser =>
      appName.includes(browser)
    );
  
    if (isBrowser && isRealWebDomain(domain)) {
      return {
        domain,
        iconUrl: `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
      };
    }
  
    return {
      domain: isRealWebDomain(domain) ? domain : null,
      iconUrl: appIconUrl
    };
  }