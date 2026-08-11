import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

const USER_ID = "7007b337-6f7b-4d6a-86f9-dc4da4ed48c4";
export const getUserId = () => USER_ID;

// â”€â”€â”€ CLIENT-SIDE RESPONSE CACHE â”€â”€â”€
// The dashboard loads a lot of aggregate analytics that changes infrequently.
// Caching them in-memory (across routes within a session) makes revisiting a
// page near-instant instead of re-hitting the API with `cache: "no-store"`.
// Returning the SAME object reference for a cached key also lets `React.memo`
// children skip re-rendering when the parent re-fetches.
const CACHE_TTL_MS = 15 * 1000;
const responseCache = new Map<string, { at: number; data: unknown }>();

export function clearApiCache() {
  responseCache.clear();
}

function isCacheableGet(endpoint: string): boolean {
  // Never cache live session/status endpoints (their responses are time-sensitive).
  return !/(\/active|\/status)/.test(endpoint);
}

// â”€â”€â”€ UNIFIED REQUEST HELPER â”€â”€â”€
async function request(endpoint: string, init: RequestInit = {}) {
  const method = (init.method || "GET").toUpperCase();

  const cacheable = method === "GET" && isCacheableGet(endpoint);
  const cacheKey = `${method} ${endpoint}`;

  if (cacheable) {
    const hit = responseCache.get(cacheKey);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      return hit.data;
    }
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    cache: "no-store",
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {})
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API Error: ${res.status} ${text}`);
  }

  const json = await res.json();

  if (cacheable) {
    responseCache.set(cacheKey, { at: Date.now(), data: json });
  } else if (method !== "GET") {
    responseCache.clear();
  }

  return json;
}

// â”€â”€â”€ FOCUS / DEEP WORK API â”€â”€â”€
export const focusApi = {
  start: (data: {
    goal?: string;
    plannedMinutes: number;
    enforcement: "observe" | "warn" | "block" | "require_reason";
    allowedApps?: string[];
    allowedDomains?: string[];
    blockedApps?: string[];
    blockedDomains?: string[];
  }) => api.post("/focus/start", { userId: USER_ID, ...data }),

  end: (id: string, status: "completed" | "abandoned") =>
    api.post(`/focus/${id}/end`, { userId: USER_ID, status }),

  getActive: () => api.get(`/focus/active?userId=${USER_ID}`),
  getActiveStatus: () => api.get(`/focus/active/status?userId=${USER_ID}`),
  getHistory: () => api.get(`/focus/history?userId=${USER_ID}`),
  getResult: (id: string) => api.get(`/focus/${id}/result?userId=${USER_ID}`),
  
  resolveIntervention: (id: string, reason: string, action?: string) =>
    api.post(`/focus/interventions/${id}/resolve`, { reason, action }),
};

// â”€â”€â”€ LEGACY FETCH WRAPPERS â”€â”€â”€
export function fetchActiveDeepWorkSession(userId: string) {
  return request(`/focus/active?userId=${userId}&t=${Date.now()}`);
}

export function fetchDeepWorkHistory(userId: string) {
  return request(`/focus/history?userId=${userId}&t=${Date.now()}`);
}

export function startDeepWorkSession(payload: any) {
  return request("/focus/start", {
    method: "POST",
    body: JSON.stringify({ ...payload, userId: USER_ID })
  });
}

export function endDeepWorkSession(id: string, userId: string, status = "completed") {
  return request(`/focus/${id}/end`, {
    method: "POST",
    body: JSON.stringify({ userId, status })
  });
}

export function resolveFocusIntervention(id: string, reason?: string, action = "allowed_once") {
  return request(`/focus/interventions/${id}/resolve`, {
    method: "POST",
    body: JSON.stringify({ reason, action })
  });
}

// â”€â”€â”€ LEGACY ANALYTICS FETCH WRAPPERS â”€â”€â”€
export function fetchDaily(userId: string, date: string) {
  return request(`/analytics/daily?userId=${userId}&date=${date}`);
}

export async function fetchDailyFocusTrend(userId: string, date: string, bucketMinutes = 60) {
  return request(`/analytics/daily-focus-trend?userId=${userId}&date=${date}&bucketMinutes=${bucketMinutes}`);
}

export const fetchTimeline = async (
  userId: string,
  from?: string,
  to?: string,
  date?: string
) => {
  const params = new URLSearchParams({ userId });
  if (from) params.append("from", from);
  if (to) params.append("to", to);
  if (date) params.append("date", date);

  const res = await fetch(`${API_BASE}/analytics/timeline?${params}`);
  if (!res.ok) throw new Error(`Timeline fetch failed: ${res.status}`);
  return res.json();
};

export function fetchAnalytics(userId: string) {
  return request(`/analytics?userId=${userId}`);
}

export const fetchHeatmap = async (
  userId: string,
  from?: string,
  to?: string,
  colorMode?: "score" | "productivity" | "duration" | "focus" | "idle",
  category?: string | null
) => {
  const params = new URLSearchParams({ userId });
  if (from) params.append("from", from);
  if (to) params.append("to", to);
  if (colorMode) params.append("colorMode", colorMode);
  if (category) params.append("category", category);

  const res = await fetch(`${API_BASE}/analytics/heatmap?${params}`);
  if (!res.ok) throw new Error(`Heatmap fetch failed: ${res.status}`);
  return res.json();
};

// â”€â”€â”€ PROJECTS API â”€â”€â”€
export const projectsApi = {
  list: (userId: string) => request(`/api/projects?userId=${userId}`),
  create: (data: { userId: string; name: string; icon?: string; color?: string; weeklyHourGoal?: number }) =>
    request("/api/projects", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: { name?: string; icon?: string; color?: string; weeklyHourGoal?: number; active?: boolean }) =>
    request(`/api/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request(`/api/projects/${id}`, {
      method: "DELETE",
    }),
};

export const projectRulesApi = {
  list: (projectId: string) => request(`/api/projects/${projectId}/rules`),
  create: (projectId: string, data: { appName?: string; domain?: string; titleKeyword?: string; matchType?: string }) =>
    request(`/api/projects/${projectId}/rules`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  delete: (projectId: string, ruleId: string) =>
    request(`/api/projects/${projectId}/rules/${ruleId}`, {
      method: "DELETE",
    }),
};

// â”€â”€â”€ CALENDAR API â”€â”€â”€
export const calendarApi = {
  list: (userId: string, from?: string, to?: string) => {
    const params = new URLSearchParams({ userId });
    if (from) params.append("from", from);
    if (to) params.append("to", to);
    return request(`/api/calendar?${params}`);
  },
  overlay: (userId: string, from: string, to: string) => {
    const params = new URLSearchParams({ userId, from, to });
    return request(`/api/calendar/overlay?${params}`);
  },
  import: (data: { userId: string; ics?: string; url?: string }) =>
    request("/api/calendar/import", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  create: (data: {
    userId: string;
    title: string;
    startAt: string;
    endAt: string;
    allDay?: boolean;
    color?: string;
    description?: string;
    location?: string;
    status?: string;
    busy?: boolean;
    recurrenceRule?: string;
    reminderMinutes?: number | null;
    projectId?: string;
    deepWorkId?: string;
    notes?: string;
  }) =>
    request("/api/calendar", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: any) =>
    request(`/api/calendar/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request(`/api/calendar/${id}`, {
      method: "DELETE",
    }),
};

// â”€â”€â”€ GOALS API â”€â”€â”€
export const goalsApi = {
  list: (userId: string, period?: string) => {
    const params = new URLSearchParams({ userId });
    if (period) params.append("period", period);
    return request(`/api/goals?${params}`);
  },
  create: (data: {
    userId: string;
    title: string;
    description?: string;
    type?: string;
    unit?: string;
    target: number;
    period?: string;
    startDate?: string;
    endDate?: string;
    priority?: string;
    projectId?: string;
  }) =>
    request("/api/goals", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: {
    title?: string;
    description?: string;
    type?: string;
    unit?: string;
    target?: number;
    period?: string;
    startDate?: string | null;
    endDate?: string | null;
    priority?: string;
    projectId?: string | null;
    active?: boolean;
  }) =>
    request(`/api/goals/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request(`/api/goals/${id}`, {
      method: "DELETE",
    }),
};

// â”€â”€â”€ RATINGS API â”€â”€â”€
export const ratingsApi = {
  create: (data: { userId: string; rating: number; deepWorkId?: string }) =>
    request("/api/ratings", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  list: (userId: string, from?: string, to?: string) => {
    const params = new URLSearchParams({ userId });
    if (from) params.append("from", from);
    if (to) params.append("to", to);
    return request(`/api/ratings?${params}`);
  },
};
