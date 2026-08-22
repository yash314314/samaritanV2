export interface ApiEndpoint {
  id: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  domain: 'Activity & Ingestion' | 'Analytics & Metrics' | 'Deep Work & Focus' | 'Calendar Intelligence' | 'Projects & Rules' | 'Goals & Streaks' | 'Webhooks & System';
  purpose: string;
  auth: boolean;
  controller: string;
  service: string;
  requestShape?: string;
  responseShape: string;
  persistsTo: string[];
}

export const ENDPOINT_MANIFEST: ApiEndpoint[] = [
  // Activity & Ingestion
  {
    id: 'ep-activity-current',
    method: 'GET',
    path: '/api/activity/current',
    domain: 'Activity & Ingestion',
    purpose: 'Fetches active window observation tick and instant focus score.',
    auth: true,
    controller: 'api/src/routes/activity.ts',
    service: 'api/src/services/activityService.ts',
    responseShape: '{ userId: string, app: string, title: string, duration: number, focusImpact: number }',
    persistsTo: ['Session', 'Activity']
  },
  {
    id: 'ep-activity-timeline',
    method: 'GET',
    path: '/api/activity/timeline',
    domain: 'Activity & Ingestion',
    purpose: 'Retrieves chronological timeline of window sessions color-coded by intent.',
    auth: true,
    controller: 'api/src/routes/activity.ts',
    service: 'api/src/services/timelineservice.ts',
    responseShape: 'Array<{ id: string, appName: string, windowTitle: string, startTime: Date, duration: number }>',
    persistsTo: ['Activity']
  },

  // Analytics & Metrics
  {
    id: 'ep-analytics-summary',
    method: 'GET',
    path: '/api/analytics/summary',
    domain: 'Analytics & Metrics',
    purpose: 'Computes total focus score, entropy index, productivity score, and burnout risk.',
    auth: true,
    controller: 'api/src/routes/analytics.ts',
    service: 'api/src/services/metricEngine.ts',
    responseShape: '{ focusScore: number, productivityScore: number, entropyScore: number, burnoutRisk: number }',
    persistsTo: ['Session']
  },
  {
    id: 'ep-analytics-heatmap',
    method: 'GET',
    path: '/api/analytics/heatmap',
    domain: 'Analytics & Metrics',
    purpose: 'Generates 24x7 matrix of focus intensity across every hour of the week.',
    auth: true,
    controller: 'api/src/routes/analytics.ts',
    service: 'api/src/services/analyticsService.ts',
    responseShape: 'Record<string, Record<string, { duration: number, focus: number, topApps: Array<any> }>>',
    persistsTo: ['Session', 'Activity']
  },

  // Deep Work & Focus
  {
    id: 'ep-focus-start',
    method: 'POST',
    path: '/api/focus/start',
    domain: 'Deep Work & Focus',
    purpose: 'Starts active countdown or Pomodoro focus session with enforcement level.',
    auth: true,
    controller: 'api/src/routes/focus.ts',
    service: 'api/src/services/deepWorkService.ts',
    requestShape: '{ userId: string, plannedMinutes: number, enforcement: "observe"|"warn"|"require_reason"|"block", timerMode: "pomodoro" }',
    responseShape: '{ id: string, status: "active", currentRound: 1, currentPhase: "focus", startedAt: string }',
    persistsTo: ['DeepWorkSession', 'DeepWorkPhase']
  },
  {
    id: 'ep-focus-intervention',
    method: 'POST',
    path: '/api/focus/intervention',
    domain: 'Deep Work & Focus',
    purpose: 'Logs blocked app launch intervention, warning toast, or reason justification.',
    auth: true,
    controller: 'api/src/routes/focus.ts',
    service: 'api/src/services/distractionBlockService.ts',
    requestShape: '{ deepWorkId: string, appName: string, actionTaken: string, justification?: string }',
    responseShape: '{ id: string, actionTaken: string, allowedGraceMinutes?: number }',
    persistsTo: ['FocusIntervention', 'DeepWorkSession']
  },
  {
    id: 'ep-focus-end',
    method: 'POST',
    path: '/api/focus/:id/end',
    domain: 'Deep Work & Focus',
    purpose: 'Ends focus block, computes session focus score, and triggers break recommendations.',
    auth: true,
    controller: 'api/src/routes/focus.ts',
    service: 'api/src/services/deepWorkService.ts',
    responseShape: '{ id: string, status: "completed", focusScore: number, productiveMs: number }',
    persistsTo: ['DeepWorkSession', 'SmartBreak']
  },

  // Calendar Intelligence
  {
    id: 'ep-calendar-dashboard',
    method: 'GET',
    path: '/api/calendar/dashboard',
    domain: 'Calendar Intelligence',
    purpose: 'Fetches calendar dashboard, overlay alignment, and meeting load metrics.',
    auth: true,
    controller: 'api/src/routes/calendar.ts',
    service: 'api/src/services/calendarTrackingService.ts',
    responseShape: '{ events: Array<CalendarEvent>, sessions: Array<CalendarSession>, summary: any }',
    persistsTo: ['CalendarEvent', 'CalendarSession']
  },
  {
    id: 'ep-calendar-events-post',
    method: 'POST',
    path: '/api/calendar/events',
    domain: 'Calendar Intelligence',
    purpose: 'Creates scheduled calendar event with optional focus auto-protection.',
    auth: true,
    controller: 'api/src/routes/calendar.ts',
    service: 'api/src/services/calendarFocusService.ts',
    requestShape: '{ userId: string, title: string, startAt: string, endAt: string, focusAutoStart: true }',
    responseShape: '{ id: string, title: string, startAt: string, focusEnforcement: "warn" }',
    persistsTo: ['CalendarEvent']
  },

  // Projects & Rules
  {
    id: 'ep-projects-list',
    method: 'GET',
    path: '/api/projects',
    domain: 'Projects & Rules',
    purpose: 'Fetches active projects, matching rules, and weekly hour progress.',
    auth: true,
    controller: 'api/src/routes/projects.ts',
    service: 'api/src/services/projectTimeService.ts',
    responseShape: 'Array<{ id: string, name: string, color: string, weeklyHourGoal: number, timeSummary: any }>',
    persistsTo: ['Project', 'ProjectTime']
  },
  {
    id: 'ep-project-rules-post',
    method: 'POST',
    path: '/api/projects/:projectId/rules',
    domain: 'Projects & Rules',
    purpose: 'Creates pattern rule for automatic application/keyword project attribution.',
    auth: true,
    controller: 'api/src/routes/projectRules.ts',
    service: 'api/src/services/projectTagger.ts',
    requestShape: '{ appName?: string, domain?: string, titleKeyword?: string, matchType: "exact"|"contains" }',
    responseShape: '{ id: string, projectId: string, appName: string, titleKeyword: string }',
    persistsTo: ['ProjectRule']
  },

  // Goals & Streaks
  {
    id: 'ep-goals-dashboard',
    method: 'GET',
    path: '/api/goals/dashboard',
    domain: 'Goals & Streaks',
    purpose: 'Fetches goal dashboard, streak tracking, progress ratio, and pace forecasts.',
    auth: true,
    controller: 'api/src/routes/goals.ts',
    service: 'api/src/services/goalProgressService.ts',
    responseShape: '{ goals: Array<Goal>, summary: { active: number, completed: number, bestStreak: number } }',
    persistsTo: ['Goal', 'GoalSnapshot']
  },

  // Webhooks & System
  {
    id: 'ep-webhooks-post',
    method: 'POST',
    path: '/api/webhooks',
    domain: 'Webhooks & System',
    purpose: 'Registers HTTP webhook endpoint for session, focus, and calendar events.',
    auth: true,
    controller: 'api/src/routes/webhooks.ts',
    service: 'api/src/services/webhookService.ts',
    requestShape: '{ userId: string, url: string, events: Array<string> }',
    responseShape: '{ id: string, url: string, secret: string, active: true }',
    persistsTo: ['WebhookEndpoint']
  }
];
