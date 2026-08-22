const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const html = fs.readFileSync(path.join(root, "renderer", "widget.html"), "utf8");
const css = fs.readFileSync(path.join(root, "renderer", "widget.css"), "utf8");
const renderer = fs.readFileSync(path.join(root, "renderer", "widget.js"), "utf8");
const preload = fs.readFileSync(path.join(root, "widgetPreload.js"), "utf8");
const main = fs.readFileSync(path.join(root, "main.js"), "utf8");

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
assert.match(css, /border-top:\s*2px solid #8b5cf6/);
assert.match(css, /prefers-reduced-motion/);
assert.match(main, /width:\s*360/);
assert.match(main, /height:\s*90/);
assert.match(main, /widgetExpanded \? 320 : 90/);

console.log(`Widget renderer verification passed: ${new Set(referencedIds).size} DOM bindings and ${new Set(sentChannels).size} IPC actions.`);
