// Applies Prisma migrations to whichever database DATABASE_TARGET selects.
// Used by the container entrypoint, CI and `npm run db:migrate`.
import "dotenv/config";
import { spawnSync } from "child_process";
import path from "path";
import { describeDatabase, resolveDatabaseConfig } from "../config/database";

const config = resolveDatabaseConfig();
const target = describeDatabase(config);
console.log(`[DB] Applying migrations to the ${target.target} database "${target.database}" on ${target.host}:${target.port}`);

const root = path.resolve(__dirname, "../..");
const result = spawnSync(
  path.join(root, "node_modules/.bin/prisma"),
  ["migrate", process.argv[2] === "status" ? "status" : "deploy", "--schema", path.join(root, "prisma/schema.prisma")],
  { stdio: "inherit", env: { ...process.env, DATABASE_URL: config.url } }
);
process.exit(result.status ?? 1);
