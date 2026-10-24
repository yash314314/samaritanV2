// Imported first by every integration test, before anything that reads
// process.env at load time (config, Prisma client, routes).
import os from "os";
import path from "path";

const url = process.env.TEST_DATABASE_URL || "postgresql://postgres:password@localhost:5432/acpe_test?schema=public";

// These tests truncate tables. Refuse anything that is not a throwaway database.
if (!/\/[A-Za-z0-9_]+_test(\?|$)/.test(url)) {
  throw new Error(`Integration tests only run against a database whose name ends in "_test" (got ${url.replace(/\/\/[^@]*@/, "//***@")})`);
}

process.env.NODE_ENV = "test";
process.env.DATABASE_TARGET = "local";
process.env.LOCAL_DATABASE_URL = url;
process.env.DATABASE_URL = url;
process.env.JWT_SECRET = "integration-test-secret-0123456789-abcdefghijklmnop";
process.env.ALLOW_REGISTRATION = "true";
process.env.LOCAL_DEVICE_ENROLLMENT = "true";
process.env.DEVICE_ENROLLMENT_KEY_FILE = path.join(os.tmpdir(), `samaritan-it-${process.pid}`, "device-enrollment.key");
process.env.API_RATE_LIMIT_PER_MINUTE = "100000";
delete process.env.CORS_ORIGIN;
delete process.env.AUTH_ORIGINS;
delete process.env.LOCAL_OWNER_USER_ID;
delete process.env.TRUST_PROXY;

export const TEST_DATABASE_URL = url;
export const DASHBOARD_ORIGIN = "http://localhost:4001";
