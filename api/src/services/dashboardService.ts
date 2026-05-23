import { prisma } from "../prisma";
import { getISTDayRange } from "../utils/time";

export async function getDashboard(userId: string, date: string) {

  /* ---------- IST DAY RANGE ---------- */

  const { start, end } =
    getISTDayRange(new Date(date + "T00:00:00"));

  /* ---------- TIMELINE ---------- */

  const timeline = await prisma.activity.findMany({
    where: {
      session: { userId },
      startTime: {
        gte: start,
        lt: end
      }
    },
    orderBy: {
      startTime: "asc"
    }
  });

  /* ---------- APPS ---------- */

  const apps = await prisma.activity.groupBy({
    by: ["appName"],
    where: {
      session: { userId },
      startTime: {
        gte: start,
        lt: end
      }
    },
    _sum: {
      duration: true
    },
    orderBy: {
      _sum: {
        duration: "desc"
      }
    }
  });

  /* ---------- WINDOWS ---------- */

  const windows = await prisma.activity.groupBy({
    by: ["windowTitle"],
    where: {
      session: { userId },
      startTime: {
        gte: start,
        lt: end
      }
    },
    _sum: {
      duration: true
    },
    orderBy: {
      _sum: {
        duration: "desc"
      }
    }
  });

  /* ---------- METRICS ---------- */

  const totalTime =
    timeline.reduce((sum, a) => sum + a.duration, 0);

  const switches =
    timeline.length > 0 ? timeline.length - 1 : 0;

  const metrics = {
    totalTime,
    switches
  };

  return {

    metrics,

    timeline,

    apps: apps.map(a => ({
      name: a.appName,
      duration: a._sum.duration ?? 0
    })),

    windows: windows.map(w => ({
      title: w.windowTitle,
      duration: w._sum.duration ?? 0
    }))

  };

}