import assert from "node:assert/strict";

import { prisma } from "../prisma";
import { endDeepWorkSession, startDeepWorkSession } from "../services/deepWorkService";
import {
  getWidgetState,
  quickTagWidgetActivity,
  updateWidgetCurrentContext,
  updateWidgetPersistedActivity,
} from "../services/widgetStateService";

async function main() {
  const user = await prisma.user.create({ data: { name: "Widget state verifier" } });
  let deepWorkId: string | null = null;
  try {
    const project = await prisma.project.create({
      data: { userId: user.id, name: "Widget Project", color: "#8b5cf6" },
    });
    const session = await prisma.session.create({ data: { userId: user.id } });
    const activity = await prisma.activity.create({
      data: {
        sessionId: session.id,
        appName: "Code",
        windowTitle: "Widget verification",
        startTime: new Date(Date.now() - 60_000),
        endTime: new Date(),
        duration: 60_000,
        type: "active",
        category: "productive",
      },
    });

    await updateWidgetCurrentContext(user.id, {
      app: "Code",
      title: "Widget verification",
      domain: null,
      observedAt: new Date().toISOString(),
    });
    await updateWidgetPersistedActivity(user.id, activity);
    const initial = await getWidgetState(user.id);
    assert.equal(initial.currentActivity?.activityId, activity.id);
    assert.equal(initial.projects[0]?.id, project.id);
    assert.equal(initial.suggestedProject, null);

    const tagged = await quickTagWidgetActivity(user.id, project.id, activity.id);
    assert.equal(tagged.activityId, activity.id);
    assert.equal((await prisma.activity.findUnique({ where: { id: activity.id } }))?.projectId, project.id);
    assert.equal(await prisma.projectRule.count({ where: { projectId: project.id, appName: "Code" } }), 1);
    assert.equal((await getWidgetState(user.id)).suggestedProject?.id, project.id);

    const focus = await startDeepWorkSession({
      userId: user.id,
      goal: "Widget focus",
      plannedMinutes: 25,
      enforcement: "warn",
    });
    deepWorkId = focus.id;
    const focused = await getWidgetState(user.id);
    assert.equal(focused.focus?.id, focus.id);
    assert.ok((focused.focus?.remainingSeconds ?? 0) > 0);
    await endDeepWorkSession(user.id, focus.id, "completed");
    deepWorkId = null;
  } finally {
    if (deepWorkId) await prisma.deepWorkSession.deleteMany({ where: { id: deepWorkId } });
    await prisma.projectRule.deleteMany({ where: { project: { userId: user.id } } });
    await prisma.activity.deleteMany({ where: { session: { userId: user.id } } });
    await prisma.session.deleteMany({ where: { userId: user.id } });
    await prisma.deepWorkSession.deleteMany({ where: { userId: user.id } });
    await prisma.project.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }

  console.log("Widget verification passed: current state, project quick-tag feedback, and focus lifecycle.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
