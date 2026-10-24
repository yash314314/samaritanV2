// Which Postgres the API talks to. One switch, read once at startup:
//
//   DATABASE_TARGET=local   (default) LOCAL_DATABASE_URL, falling back to DATABASE_URL
//   DATABASE_TARGET=global  GLOBAL_DATABASE_URL, a shared database for many users
//
// The Prisma client, the Prisma CLI (prisma.config.ts) and the container
// migration step all resolve the URL through this module, so they can never
// disagree about which database they are pointed at.

export type DatabaseTarget = "local" | "global";

export interface DatabaseConfig {
  target: DatabaseTarget;
  url: string;
}

export interface DatabaseDescription {
  target: DatabaseTarget;
  host: string;
  port: number;
  database: string;
  ssl: boolean;
}

const POSTGRES_URL = /^postgres(ql)?:\/\//i;
const SECURE_SSL_MODES = new Set(["require", "verify-ca", "verify-full"]);
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function resolveDatabaseConfig(env: NodeJS.ProcessEnv = process.env): DatabaseConfig {
  const target = (env.DATABASE_TARGET || "local").trim().toLowerCase();
  if (target !== "local" && target !== "global") {
    throw new Error(`DATABASE_TARGET must be "local" or "global" (got "${env.DATABASE_TARGET}")`);
  }

  const url = target === "global" ? env.GLOBAL_DATABASE_URL : env.LOCAL_DATABASE_URL || env.DATABASE_URL;
  if (!url) {
    throw new Error(
      target === "global"
        ? "DATABASE_TARGET=global requires GLOBAL_DATABASE_URL"
        : "Set LOCAL_DATABASE_URL (or DATABASE_URL) to the local Postgres connection string"
    );
  }
  if (!POSTGRES_URL.test(url)) {
    throw new Error(`The ${target} database URL must be a postgres:// or postgresql:// connection string`);
  }
  return { target, url };
}

/** Connection details safe to log or return from an admin endpoint: never the credentials. */
export function describeDatabase(config: DatabaseConfig): DatabaseDescription {
  const parsed = new URL(config.url);
  const sslMode = (parsed.searchParams.get("sslmode") || "").toLowerCase();
  return {
    target: config.target,
    host: parsed.hostname,
    port: Number(parsed.port) || 5432,
    database: decodeURIComponent(parsed.pathname.replace(/^\//, "")) || "postgres",
    ssl: SECURE_SSL_MODES.has(sslMode) || parsed.searchParams.get("ssl") === "true",
  };
}

/** Warnings worth printing at startup; empty when the configuration is sound. */
export function databaseWarnings(config: DatabaseConfig): string[] {
  const description = describeDatabase(config);
  const warnings: string[] = [];
  // Loopback and single-label hosts (a compose service such as "postgres") sit
  // on a private network; anything else crosses one.
  const privateNetwork = LOOPBACK_HOSTS.has(description.host) || !description.host.includes(".");
  if (config.target === "global" && !description.ssl && !privateNetwork) {
    warnings.push(
      `The global database at ${description.host} is reached without TLS. Add ?sslmode=require (or verify-full) to GLOBAL_DATABASE_URL.`
    );
  }
  return warnings;
}
