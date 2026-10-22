const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const html = fs.readFileSync(path.join(root, "renderer", "widget.html"), "utf8");
const css = fs.readFileSync(path.join(root, "renderer", "widget.css"), "utf8");
const renderer = fs.readFileSync(path.join(root, "renderer", "widget.js"), "utf8");
const preload = fs.readFileSync(path.join(root, "widgetPreload.js"), "utf8");
const main = fs.readFileSync(path.join(root, "main.js"), "utf8");
const theme = require("./renderer/widgetTheme.js");
const dashboardAppearance = fs.readFileSync(path.join(root, "..", "dashboard", "lib", "appearance.ts"), "utf8");

const referencedIds = [...renderer.matchAll(/byId\("([^"]+)"\)/g)].map((match) => match[1]);
for (const id of new Set(referencedIds)) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `renderer references missing #${id}`);
}

const sentChannels = [...preload.matchAll(/ipcRenderer\.send\("([^"]+)"/g)].map((match) => match[1]);
for (const channel of new Set(sentChannels)) {
  assert.ok(main.includes(`ipcMain.on("${channel}"`), `main process does not handle ${channel}`);
}

assert.match(html, /Content-Security-Policy/);
assert.doesNotMatch(html, /nodeIntegration|require\s*\(/);

// Appearance: the widget's catalogue matches the dashboard's Settings page.
function dashboardTable(name) {
  const match = dashboardAppearance.match(new RegExp(`export const ${name} = ({[\\s\\S]*?\\n}) satisfies`));
  assert.ok(match, `dashboard/lib/appearance.ts no longer exports ${name} as an object literal`);
  return new Function(`return (${match[1]});`)();
}
const dashboardThemes = dashboardTable("THEMES");
const dashboardAccents = dashboardTable("ACCENTS");
const dashboardFonts = dashboardTable("FONTS");
assert.deepEqual(Object.keys(theme.THEMES).sort(), Object.keys(dashboardThemes).sort(), "theme ids differ from the dashboard");
for (const [id, def] of Object.entries(dashboardThemes)) {
  assert.equal(theme.THEMES[id].mode, def.mode, `theme ${id} mode differs`);
  assert.deepEqual(theme.THEMES[id].tokens, def.tokens, `theme ${id} tokens differ`);
}
for (const [id, def] of Object.entries(dashboardAccents)) {
  assert.deepEqual(theme.ACCENTS[id], { dark: def.dark, light: def.light }, `accent ${id} differs`);
}
assert.deepEqual(Object.keys(theme.ACCENTS).sort(), Object.keys(dashboardAccents).sort(), "accent ids differ from the dashboard");
assert.deepEqual(Object.keys(theme.FONTS).sort(), Object.keys(dashboardFonts).sort(), "typeface ids differ from the dashboard");

// The stylesheet defaults are the default appearance, and colours outside
// :root come from the appearance properties only.
const rootBlock = css.match(/:root\s*{([^}]*)}/)[1];
const defaults = theme.buildVars(theme.DEFAULT_APPEARANCE).vars;
for (const [name, value] of Object.entries(defaults)) {
  assert.ok(rootBlock.includes(`${name}: ${value};`), `widget.css :root default for ${name} should be ${value}`);
}
assert.doesNotMatch(css.replace(/:root\s*{[^}]*}/, ""), /#[0-9a-f]{3,8}\b|rgba?\(/i, "widget.css uses a raw colour outside :root");
for (const [, file] of css.matchAll(/url\("([^"]+)"\)/g)) {
  assert.ok(fs.existsSync(path.join(root, "renderer", file)), `missing font file renderer/${file}`);
}
assert.ok(html.indexOf("widgetTheme.js") !== -1 && html.indexOf("widgetTheme.js") < html.indexOf("widget.js\""), "widgetTheme.js must load before widget.js");
assert.ok(main.includes('onWs("appearance:changed"'), "main process does not forward appearance changes");
assert.deepEqual(theme.resolve({ theme: "nope", accent: 5 }), theme.DEFAULT_APPEARANCE, "unknown appearance ids must fall back to defaults");
assert.match(css, /prefers-reduced-motion/);
assert.match(main, /width:\s*360/);
assert.match(main, /height:\s*90/);
assert.match(main, /widgetExpanded \? 320 : 90/);

console.log(`Widget renderer verification passed: ${new Set(referencedIds).size} DOM bindings, ${new Set(sentChannels).size} IPC actions, ${Object.keys(dashboardThemes).length} themes in parity with the dashboard.`);
