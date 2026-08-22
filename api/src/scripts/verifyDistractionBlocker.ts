import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { prisma } from "../prisma";
import {
  createDistractionBlock,
  deleteDistractionBlock,
  getActiveDistractionBlockState,
  getDistractionBlockDashboard,
  normalizeDistractionTarget,
  recordDistractionBlockEvent,
  updateDistractionBlock,
} from "../services/distractionBlockService";

async function main() {
  assert.equal(normalizeDistractionTarget("domain", "https://www.Reddit.com/r/test"), "reddit.com");
  assert.equal(normalizeDistractionTarget("app", "Discord.exe"), "discord");

  const user = await prisma.user.create({ data: { name: "Distraction blocker verifier" } });
  try {
    const alwaysRule = await createDistractionBlock(user.id, {
      targetType: "app",
      target: "Discord.exe",
      scope: "always",
    });
    const focusRule = await createDistractionBlock(user.id, {
      targetType: "domain",
      target: "https://www.reddit.com/r/productivity",
      scope: "during_focus",
    });
    assert.equal(alwaysRule.normalizedTarget, "discord");
    assert.equal(focusRule.normalizedTarget, "reddit.com");

    const outsideFocus = await getActiveDistractionBlockState(user.id);
    assert.equal(outsideFocus.rules.length, 2);
    assert.deepEqual(outsideFocus.activeRules.map((rule) => rule.id), [alwaysRule.id]);

    const deepWork = await prisma.deepWorkSession.create({
      data: {
        userId: user.id,
        goal: "Verify scoped blocker",
        plannedMinutes: 30,
        status: "active",
        enforcement: "block",
        allowedApps: [],
        allowedDomains: [],
        blockedApps: [],
        blockedDomains: [],
      },
    });
    const duringFocus = await getActiveDistractionBlockState(user.id);
    assert.equal(duringFocus.focusActive, true);
    assert.equal(duringFocus.activeRules.length, 2);

    await updateDistractionBlock(user.id, alwaysRule.id, { active: false });
    const afterDisable = await getActiveDistractionBlockState(user.id);
    assert.deepEqual(afterDisable.rules.map((rule) => rule.id), [focusRule.id]);

    const eventId = randomUUID();
    const payload = {
      id: eventId,
      ruleId: focusRule.id,
      targetType: "domain",
      target: "reddit.com",
      appName: "Brave",
      domain: "reddit.com",
      windowTitle: "Reddit",
      processId: 1234,
      outcome: "killed",
      reason: "Successfully terminated pid 1234",
    };
    await recordDistractionBlockEvent(user.id, payload);
    await recordDistractionBlockEvent(user.id, payload);
    assert.equal(await prisma.distractionBlockEvent.count({ where: { id: eventId } }), 1, "event retries must be idempotent");

    const dashboard = await getDistractionBlockDashboard(user.id);
    assert.equal(dashboard.summary.totalRules, 2);
    assert.equal(dashboard.summary.killedToday, 1);
    assert.equal(dashboard.recentEvents[0]?.ruleId, focusRule.id);

    await deleteDistractionBlock(user.id, focusRule.id);
    assert.equal(await prisma.distractionBlock.count({ where: { id: focusRule.id } }), 0);
    await prisma.deepWorkSession.delete({ where: { id: deepWork.id } });
  } finally {
    await prisma.distractionBlockEvent.deleteMany({ where: { userId: user.id } });
    await prisma.distractionBlock.deleteMany({ where: { userId: user.id } });
    await prisma.deepWorkSession.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }

  console.log("Distraction blocker verification passed: CRUD, scopes, active resolution, telemetry, and idempotency.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
