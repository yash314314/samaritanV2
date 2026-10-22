import assert from "node:assert/strict";
import { test, describe } from "node:test";
import { getAppAliases } from "../contextClassifier";

describe("getAppAliases", () => {
  test("Linux window classes join their alias group", () => {
    assert.ok(getAppAliases("brave-browser").has("brave"));
    assert.ok(getAppAliases("code-oss").has("code"));
    assert.ok(getAppAliases("chrome-pgmdgibpghdecnfpfdllbgopbbacglgg-Default").has("chrome"));
    assert.ok(getAppAliases("org.telegram.desktop").has("telegram"));
  });

  test("Windows names keep working", () => {
    assert.ok(getAppAliases("msedge.exe").has("microsoft edge".replace(/^microsoft\s+/, "")));
    assert.ok(getAppAliases("Google Chrome").has("chrome"));
    assert.ok(getAppAliases("Visual Studio Code").has("code"));
  });

  test("a short name is not pulled into a group whose alias merely contains it", () => {
    const aliases = getAppAliases("desktop");
    assert.deepEqual([...aliases], ["desktop"]);
  });

  test("fragments inside longer words do not match", () => {
    assert.ok(!getAppAliases("vscodeium").has("code"));
    assert.ok(!getAppAliases("chromecast-helper").has("chrome"));
  });
});
