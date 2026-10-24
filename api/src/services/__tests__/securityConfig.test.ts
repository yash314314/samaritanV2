import assert from "node:assert/strict";
import { test, describe } from "node:test";
import { databaseWarnings, describeDatabase, resolveDatabaseConfig } from "../../config/database";
import { loadAuthConfig } from "../../config/auth";
import { isPrivateAddress, fetchUntrustedText, UnsafeUrlError } from "../../utils/safeFetch";
import { passwordProblem } from "../../utils/password";

const LOCAL = "postgresql://postgres:pw@localhost:5432/acpe?schema=public";
const GLOBAL = "postgresql://svc:secret@db.example.com:6543/samaritan?sslmode=require";
const STRONG = "x".repeat(16) + "-a-strong-random-secret-value";

describe("DATABASE_TARGET switch", () => {
  test("local is the default and prefers LOCAL_DATABASE_URL over DATABASE_URL", () => {
    assert.deepEqual(resolveDatabaseConfig({ DATABASE_URL: LOCAL }), { target: "local", url: LOCAL });
    assert.equal(resolveDatabaseConfig({ DATABASE_URL: LOCAL, LOCAL_DATABASE_URL: GLOBAL }).url, GLOBAL);
  });

  test("global uses GLOBAL_DATABASE_URL only, and fails loudly without it", () => {
    assert.deepEqual(resolveDatabaseConfig({ DATABASE_TARGET: "GLOBAL", GLOBAL_DATABASE_URL: GLOBAL, DATABASE_URL: LOCAL }), {
      target: "global",
      url: GLOBAL,
    });
    assert.throws(() => resolveDatabaseConfig({ DATABASE_TARGET: "global", DATABASE_URL: LOCAL }), /GLOBAL_DATABASE_URL/);
  });

  test("unknown targets and non-postgres URLs are rejected", () => {
    assert.throws(() => resolveDatabaseConfig({ DATABASE_TARGET: "cloud", DATABASE_URL: LOCAL }), /local" or "global/);
    assert.throws(() => resolveDatabaseConfig({ DATABASE_URL: "mysql://x@y/z" }), /postgres/);
  });

  test("descriptions never carry credentials; a remote global database without TLS is flagged", () => {
    const described = describeDatabase({ target: "global", url: GLOBAL });
    assert.deepEqual(described, { target: "global", host: "db.example.com", port: 6543, database: "samaritan", ssl: true });
    assert.ok(!JSON.stringify(described).includes("secret"));
    assert.equal(databaseWarnings({ target: "global", url: GLOBAL }).length, 0);
    assert.equal(databaseWarnings({ target: "global", url: GLOBAL.replace("?sslmode=require", "") }).length, 1);
    assert.equal(databaseWarnings({ target: "local", url: LOCAL }).length, 0);
  });
});

describe("auth configuration", () => {
  test("local development runs with a per-process secret and registration closed", () => {
    const config = loadAuthConfig({ DATABASE_URL: LOCAL });
    assert.equal(config.ephemeralSecret, true);
    assert.ok(config.accessSecret.length >= 48);
    assert.equal(config.allowRegistration, false);
    assert.equal(config.localDeviceEnrollment, true);
    assert.equal(config.accessTtlSeconds, 15 * 60);
  });

  test("production or the global database refuse to start without a strong secret", () => {
    assert.throws(() => loadAuthConfig({ DATABASE_URL: LOCAL, NODE_ENV: "production" }), /JWT_SECRET is required/);
    assert.throws(() => loadAuthConfig({ DATABASE_TARGET: "global", GLOBAL_DATABASE_URL: GLOBAL }), /JWT_SECRET is required/);
    assert.throws(() => loadAuthConfig({ DATABASE_URL: LOCAL, JWT_SECRET: "short" }), /at least 32/);
    assert.throws(() => loadAuthConfig({ DATABASE_URL: LOCAL, JWT_SECRET: "samaritan_super_secret_jwt_key_2026" }), /published default/);
  });

  test("the global database opens registration and disables key-file enrollment", () => {
    const config = loadAuthConfig({ DATABASE_TARGET: "global", GLOBAL_DATABASE_URL: GLOBAL, JWT_SECRET: STRONG });
    assert.equal(config.ephemeralSecret, false);
    assert.equal(config.allowRegistration, true);
    assert.equal(config.localDeviceEnrollment, false);
    assert.equal(loadAuthConfig({ DATABASE_TARGET: "global", GLOBAL_DATABASE_URL: GLOBAL, JWT_SECRET: STRONG, ALLOW_REGISTRATION: "false" }).allowRegistration, false);
  });

  test("production cookies are Secure by default", () => {
    assert.equal(loadAuthConfig({ DATABASE_URL: LOCAL, NODE_ENV: "production", JWT_SECRET: STRONG }).cookieSecure, true);
    assert.equal(loadAuthConfig({ DATABASE_URL: LOCAL }).cookieSecure, false);
    assert.throws(() => loadAuthConfig({ DATABASE_URL: LOCAL, AUTH_COOKIE_SECURE: "maybe" }), /boolean/);
  });
});

describe("outbound fetch guard", () => {
  test("private, loopback, link-local and metadata addresses are recognised", () => {
    for (const address of [
      "127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1",
      "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:a9fe:a9fe", "[::ffff:7f00:1]", "64:ff9b::7f00:1", "2002:7f00:1::1", "::127.0.0.1", "::",
    ]) {
      assert.equal(isPrivateAddress(address), true, address);
    }
    for (const address of ["1.1.1.1", "8.8.8.8", "2606:4700:4700::1111", "172.32.0.1"]) {
      assert.equal(isPrivateAddress(address), false, address);
    }
  });

  test("non-http schemes, embedded credentials and private literals are refused before any request", async () => {
    process.env.ALLOW_PRIVATE_FETCH = "false";
    try {
      await assert.rejects(fetchUntrustedText("file:///etc/passwd"), UnsafeUrlError);
      await assert.rejects(fetchUntrustedText("ftp://example.com/x.ics"), UnsafeUrlError);
      await assert.rejects(fetchUntrustedText("https://user:pw@example.com/x.ics"), UnsafeUrlError);
      await assert.rejects(fetchUntrustedText("http://169.254.169.254/latest/meta-data"), UnsafeUrlError);
      await assert.rejects(fetchUntrustedText("http://[::1]:4000/health"), UnsafeUrlError);
      await assert.rejects(fetchUntrustedText("http://[::ffff:127.0.0.1]:4000/health"), UnsafeUrlError);
      await assert.rejects(fetchUntrustedText("http://[::ffff:169.254.169.254]/latest/meta-data"), UnsafeUrlError);
      await assert.rejects(fetchUntrustedText("http://2130706433/"), UnsafeUrlError);
      await assert.rejects(fetchUntrustedText("http://localhost:4000/health"), UnsafeUrlError);
    } finally {
      delete process.env.ALLOW_PRIVATE_FETCH;
    }
  });
});

describe("password policy", () => {
  test("length is bounded below and at bcrypt's 72-byte limit", () => {
    assert.match(passwordProblem("short")!, /at least/);
    assert.match(passwordProblem("é".repeat(37))!, /72 bytes/);
    assert.equal(passwordProblem("a perfectly fine passphrase"), null);
    assert.match(passwordProblem(undefined)!, /required/);
    assert.match(passwordProblem(" ".repeat(12))!, /blank/);
  });
});
