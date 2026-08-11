import { classifyActivity } from "../services/contextClassifier";
import { prisma } from "../prisma";

async function main() {
  const activities = await prisma.activity.findMany({
    orderBy: { startTime: "asc" },
    select: {
      id: true,
      appName: true,
      windowTitle: true,
      domain: true,
      url: true,
      category: true,
      intent: true,
    },
  });

  let updated = 0;

  for (const activity of activities) {
    const classification = await classifyActivity(
      activity.appName,
      activity.windowTitle,
      activity.domain ?? activity.url ?? null
    );

    const changed =
      activity.category !== classification.category ||
      activity.intent !== classification.intent;

    if (!changed) continue;

    await prisma.activity.update({
      where: { id: activity.id },
      data: {
        category: classification.category,
        intent: classification.intent,
        focusImpact: classification.focusImpact,
        energyImpact: classification.energyImpact,
        confidence: classification.confidence,
      },
    });

    updated++;
  }

  console.log(`Reclassified ${updated} of ${activities.length} activities.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
