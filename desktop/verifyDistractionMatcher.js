const assert = require("node:assert/strict");
const {
  appMatches,
  domainMatches,
  findMatchingDistractionRule,
} = require("./distractionMatcher");

assert.equal(appMatches("Discord.exe", "Discord"), true);
assert.equal(appMatches("Visual Studio Code", "Code"), false);
assert.equal(domainMatches("reddit.com", "https://www.reddit.com/r/productivity"), true);
assert.equal(domainMatches("reddit.com", "notreddit.com"), false);
assert.equal(domainMatches("youtube.com", "music.youtube.com"), true);

const focusRule = {
  id: "focus-rule",
  active: true,
  scope: "during_focus",
  targetType: "domain",
  target: "reddit.com",
  normalizedTarget: "reddit.com",
};
assert.equal(findMatchingDistractionRule([focusRule], { app: "Brave", domain: "reddit.com" }, false), null);
assert.equal(findMatchingDistractionRule([focusRule], { app: "Brave", domain: "reddit.com" }, true)?.id, "focus-rule");

const alwaysRule = {
  id: "always-rule",
  active: true,
  scope: "always",
  targetType: "app",
  target: "Discord",
  normalizedTarget: "discord",
};
assert.equal(findMatchingDistractionRule([alwaysRule], { app: "Discord.exe" }, false)?.id, "always-rule");

console.log("Distraction matcher verification passed: app aliases, subdomains, false positives, and focus scopes.");
