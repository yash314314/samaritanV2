import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

const USER_ID = "7007b337-6f7b-4d6a-86f9-dc4da4ed48c4";
export const getUserId = () => USER_ID;

// ─── UNIFIED REQUEST HELPER ───
async function request(endpoint: string, init: RequestInit = {}) {
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

  return res.json();
}

// ─── FOCUS / DEEP WORK API ───
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

// ─── LEGACY FETCH WRAPPERS ───
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

// ─── ANALYTICS API ───
export const analyticsApi = {
  // Daily analytics (returns activities + metrics)
  getDaily: (date: string) => api.get(`/analytics/daily?userId=${USER_ID}&date=${date}`),
  
  // Weekly trend (returns { date, focus, entropy } array)
  // FIXED: Use /analytics/growth which returns the trend data with focus/entropy
  getTrend: () => api.get(`/analytics/growth?userId=${USER_ID}`),
  
  // Assistant insights (returns suggestions + scores)
  getDashboard: () => api.get(`/analytics/assistant?userId=${USER_ID}`),
  
  getIntentHeatmap: () => api.get(`/analytics/intent-heatmap?userId=${USER_ID}`),
  getBurnoutRisk: () => api.get(`/analytics/burnout-risk?userId=${USER_ID}`),
};

// ─── LEGACY ANALYTICS FETCH WRAPPERS ───
export function fetchDaily(userId: string, date: string) {
  return request(`/analytics/daily?userId=${userId}&date=${date}`);
}

// FIXED: Use /analytics/growth for weekly trend data
export function fetchWeekly(userId: string) {
  return request(`/analytics/growth?userId=${userId}`);
}

// FIXED: Use /analytics/assistant for insights
export function fetchIntelligence(userId: string) {
  return request(`/analytics/assistant?userId=${userId}`);
}

export async function fetchDailyFocusTrend(userId: string, date: string, bucketMinutes = 60) {
  return request(`/analytics/daily-focus-trend?userId=${userId}&date=${date}&bucketMinutes=${bucketMinutes}`);
}

export function fetchTimeline(userId: string, date: string) {
  return request(`/analytics/timeline?userId=${userId}&date=${date}`);
}

export function fetchAnalytics(userId: string) {
  return request(`/analytics?userId=${userId}`);
}

export function fetchHeatmap(userId: string, date?: string) {
  const query = date ? `?userId=${userId}&date=${date}` : `?userId=${userId}`;
  return request(`/analytics/heatmap${query}`);
}

export async function fetchDailyComparison(userId: string) {
  const res = await fetch(`${API_BASE}/analytics/compare?userId=${userId}`);
  return res.json();
}

export async function fetchGrowth(userId: string) {
  const res = await fetch(`${API_BASE}/analytics/growth?userId=${userId}`);
  if (!res.ok) throw new Error("Failed to fetch growth trend");
  return res.json();
}

export async function fetchBurnout(userId: string) {
  const res = await fetch(`${API_BASE}/analytics/burnout?userId=${userId}`);
  if (!res.ok) throw new Error("Failed to fetch burnout risk");
  return res.json();
}

export function fetchGrowthTrend(userId: string) {
  return request(`/analytics/growth-trend?userId=${userId}`);
}

export function fetchBurnoutRisk(userId: string) {
  return request(`/analytics/burnout-risk?userId=${userId}`);
}

export function fetchIntentHeatmap(userId: string) {
  return request(`/analytics/intent-heatmap?userId=${userId}`);
}