const API_BASE = process.env.API_BASE || "http://localhost:4000";
const USER_ID =
  process.env.USER_ID || "7007b337-6f7b-4d6a-86f9-dc4da4ed48c4";

type ActivityInput = {
  app: string;
  title: string;
  domain?: string | null;
  url?: string | null;
  durationMs: number;
  type?: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {})
    }
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new Error(`${init?.method || "GET"} ${path} failed: ${res.status} ${text}`);
  }

  return data as T;
}

async function startSession() {
  return request<any>("/focus/start", {
    method: "POST",
    body: JSON.stringify({
      userId: USER_ID,
      goal: "Deep work simulation",
      plannedMinutes: 5,
      enforcement: "block",
      allowedApps: ["Cursor", "Google Chrome"],
      allowedDomains: ["github.com", "stackoverflow.com"],
      blockedApps: ["Discord", "Spotify"],
      blockedDomains: ["youtube.com", "reddit.com"]
    })
  });
}

async function sendActivity(input: ActivityInput, startsAfterMs: number) {
  const startTime = new Date(Date.now() + startsAfterMs);
  const endTime = new Date(startTime.getTime() + input.durationMs);

  return request<any>("/activity/session", {
    method: "POST",
    body: JSON.stringify({
      id: crypto.randomUUID(),
      userId: USER_ID,
      app: input.app,
      title: input.title,
      domain: input.domain ?? null,
      url: input.url ?? null,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration: input.durationMs,
      type: input.type || "active"
    })
  });
}

async function endSession(id: string) {
  return request<any>(`/focus/${id}/end`, {
    method: "POST",
    body: JSON.stringify({
      userId: USER_ID,
      status: "completed"
    })
  });
}

async function getResult(id: string) {
  return request<any>(`/focus/${id}/result?userId=${USER_ID}`);
}

async function main() {
  console.log("[simulate] Starting deep-work session");
  const session = await startSession();
  console.log("[simulate] Session:", session.id);

  const allowed = await sendActivity(
    {
      app: "Cursor",
      title: "tracker - deep work integration",
      durationMs: 30_000
    },
    0
  );
  console.log("[simulate] Allowed activity intervention:", Boolean(allowed.focusIntervention));

  const blocked = await sendActivity(
    {
      app: "Google Chrome",
      title: "YouTube - distracting tab",
      domain: "youtube.com",
      url: "https://youtube.com/watch?v=test",
      durationMs: 20_000
    },
    30_000
  );
  console.log("[simulate] Blocked activity intervention:", blocked.focusIntervention?.intervention?.action || "none");

  const recovery = await sendActivity(
    {
      app: "Google Chrome",
      title: "GitHub pull request",
      domain: "github.com",
      url: "https://github.com/example/repo/pull/1",
      durationMs: 25_000
    },
    50_000
  );
  console.log("[simulate] Recovery activity intervention:", Boolean(recovery.focusIntervention));

  await endSession(session.id);
  const result = await getResult(session.id);

  console.log("[simulate] Result summary:", {
    status: result.session.status,
    actualMinutes: result.session.actualMinutes,
    productiveMinutes: Math.round(result.metrics.productiveMinutes),
    distractionMinutes: Math.round(result.metrics.distractionMinutes),
    violationCount: result.metrics.violationCount,
    interventions: result.interventions.length
  });
}

main().catch((err) => {
  console.error("[simulate] Failed:", err);
  process.exit(1);
});
