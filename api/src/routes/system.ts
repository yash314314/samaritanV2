import { Router } from "express";
import { prisma, databaseConfig } from "../prisma";
import { describeDatabase, databaseWarnings } from "../config/database";
import { requireRole } from "../middleware/authMiddleware";
import { authConfig } from "../config/auth";

// Read-only view of how this API instance is wired. Switching databases is an
// environment change (DATABASE_TARGET) followed by a restart, never a request:
// a live switch would strand every session, token and in-flight write on the
// database it left.

const router = Router();

router.get("/database", requireRole("admin"), async (_req, res) => {
  const description = describeDatabase(databaseConfig);
  let reachable = true;
  let migrations: { applied: number; latest: string | null } | null = null;
  try {
    const rows = await prisma.$queryRaw<Array<{ applied: bigint; latest: string | null }>>`
      SELECT COUNT(*)::bigint AS applied, MAX(migration_name) AS latest
      FROM "_prisma_migrations"
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    migrations = { applied: Number(rows[0]?.applied ?? 0), latest: rows[0]?.latest ?? null };
  } catch {
    reachable = false;
  }
  res.setHeader("Cache-Control", "no-store");
  res.json({
    ...description,
    reachable,
    migrations,
    warnings: databaseWarnings(databaseConfig),
    registrationOpen: authConfig.allowRegistration,
    switchWith: "Set DATABASE_TARGET=local|global (with LOCAL_DATABASE_URL / GLOBAL_DATABASE_URL), run `npm run db:migrate`, then restart the API.",
  });
});

export default router;
