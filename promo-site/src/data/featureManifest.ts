export interface SamaritanFeature {
  id: string;
  name: string;
  badge: string;
  category: 'ingestion' | 'analytics' | 'enforcement' | 'calendar' | 'projects' | 'goals';
  summary: string;
  what: string;
  why: string;
  userExperience: string;
  uiInteraction: string;
  frontendCode: string;
  apiEndpoint: string;
  backendLogic: string;
  databaseModel: string;
  failureCases: string[];
}

export const FEATURE_MANIFEST: SamaritanFeature[] = [
  {
    id: 'active-observer',
    name: '500ms Active Window Observer Stream',
    badge: 'Realtime Protocol',
    category: 'ingestion',
    summary: 'Sub-second desktop window sampling using native Windows APIs and WebSocket ingestion.',
    what: 'Samples active window title, process executable, process ID, and URL every 500ms without cloud telemetry.',
    why: 'Self-reported time tracking is inaccurate. Continuous window observation builds reliable duration-weighted metrics.',
    userExperience: 'Live ticker in top status bar showing active application, focus weight, and real-time score curve.',
    uiInteraction: 'Switch desktop application (e.g. Cursor -> Twitter). Observer instantly broadcasts tick over WebSockets.',
    frontendCode: 'useWsMessage("activity:current", (tick) => updateSessionScore(tick))',
    apiEndpoint: 'WS ws://localhost:4000/ws (activity:current)',
    backendLogic: 'WebSocket manager validates monotonic sequence number, filters stale ticks, and updates active session duration.',
    databaseModel: 'Session & Activity entities linked via sessionId.',
    failureCases: ['System idle > 120s pauses sampling', 'Unrecognized process title triggers fallback classifier inbox']
  },
  {
    id: 'enforcement-matrix',
    name: '4-Level Deep Work Protocol Enforcement Matrix',
    badge: 'Process Blocker',
    category: 'enforcement',
    summary: 'Preemptive application execution control supporting Observe, Warn, Require Reason, and Block modes.',
    what: 'Enforces deep work boundaries by observing or terminating disallowed Windows executables.',
    why: 'Willpower alone fails during long focus blocks. Technical enforcement blocks distraction loops before they take hold.',
    userExperience: 'System overlay toast or process termination dialog when attempting to open blocked apps during focus rounds.',
    uiInteraction: 'Start focus block with mode set to "Block". Attempt opening Twitter/Slack. App process is killed immediately.',
    frontendCode: 'deepWorkApi.start({ enforcement: "block", blockedApps: ["slack.exe", "chrome.exe"] })',
    apiEndpoint: 'POST /api/focus/start & POST /api/focus/intervention',
    backendLogic: 'Electron foreground observer detects disallowed process ID and issues native taskkill termination.',
    databaseModel: 'DeepWorkSession & FocusIntervention models.',
    failureCases: ['User enters written justification in Require Reason mode to request 15m exception grace period']
  },
  {
    id: 'focus-entropy',
    name: 'Duration-Weighted Focus & Attentional Entropy',
    badge: 'Cognitive Analytics',
    category: 'analytics',
    summary: 'Shannon entropy and duration-weighted scoring quantifying cognitive context fragmentation.',
    what: 'Calculates focus impact and Shannon entropy H(A) across context switches.',
    why: 'Switching apps every 30 seconds degrades cognitive depth even if all apps are work-related.',
    userExperience: 'Analytics page displays focus impact trend, entropy index, and burnout risk warning cards.',
    uiInteraction: 'Hover over entropy index graph to inspect switch rate per hour and app distribution variance.',
    frontendCode: 'fetchAnalytics(userId, "weekly").then(renderEntropyChart)',
    apiEndpoint: 'GET /api/analytics/summary & GET /api/analytics/daily',
    backendLogic: 'Computes Shannon entropy across app durations: H(A) = -SUM(p_i * log2(p_i)) + lambda * (switches/hour).',
    databaseModel: 'Session, Activity, and AppPattern tables.',
    failureCases: ['Low confidence observations (<0.5) trigger review inbox for manual classification']
  },
  {
    id: 'calendar-intelligence',
    name: 'Notion-Style Calendar Overlays & Timeblocking',
    badge: 'Calendar Intelligence',
    category: 'calendar',
    summary: 'Compact calendar overlay comparing scheduled events against actual detected activity.',
    what: 'Imports ICS calendar feeds, overlays scheduled meetings with actual signals, and auto-protects focus blocks.',
    why: 'Resolves meeting overrun, scheduled vs actual drift, and identifies meeting fatigue pressure.',
    userExperience: 'Compact month/week/day calendar grid with light pastel purple, cyan, and emerald badges.',
    uiInteraction: 'Click calendar event -> click "Protect Focus Block" -> system auto-configures focus enforcement.',
    frontendCode: 'calendarApi.create({ title: "Deep Work", eventType: "focus", focusAutoStart: true })',
    apiEndpoint: 'GET /api/calendar/dashboard & POST /api/calendar/events',
    backendLogic: 'Matches calendar start/end times against activity timelines and computes attendance confidence score.',
    databaseModel: 'CalendarEvent, CalendarSession, CalendarReminder, and CalendarWorkHour.',
    failureCases: ['Unattended scheduled meetings trigger review inbox for user confirmation']
  },
  {
    id: 'project-workbench',
    name: 'Automated Rule-Based Project Time Attribution',
    badge: 'Regex & Keyword Rules',
    category: 'projects',
    summary: 'Automatic app, domain, and title keyword matching rules with weekly hour goal tracking.',
    what: 'Attributes tracked activities to projects using app name, domain, and title keyword rules.',
    why: 'Eliminates manual time-card logging for software engineers and designers.',
    userExperience: 'Projects page displays project progress bars, weekly target completion, and unassigned activity inbox.',
    uiInteraction: 'Select unassigned activity -> click "Create Project Rule" -> match type (exact/contains) -> save.',
    frontendCode: 'projectRulesApi.create(projectId, { appName: "Cursor", titleKeyword: "samaritan" })',
    apiEndpoint: 'POST /api/project-rules/:projectId/rules & GET /api/projects/unassigned',
    backendLogic: 'Project tagger runs regex matching against unassigned activities and updates ProjectTime totals.',
    databaseModel: 'Project, ProjectRule, ProjectTime, and Activity tables.',
    failureCases: ['Conflicting rules resolve to highest-confidence pattern match']
  },
  {
    id: 'procedural-audio',
    name: 'Procedural Web Audio Ambient Noise Engine',
    badge: 'Zero Asset Audio',
    category: 'goals',
    summary: 'Real-time HTML5 Web Audio API synthesis of Rain, Pink, White, and Brown focus noise.',
    what: 'Generates continuous focus noise algorithmically without downloading MP3 audio assets.',
    why: 'Zero network overhead, instant playback initialization, and custom volume frequency shaping.',
    userExperience: 'Ambient sound selector in Deep Work bar with live volume slider and spectrum visualization.',
    uiInteraction: 'Select "Rain Sound" -> slide volume to 30% -> audio nodes initialize instantly in browser.',
    frontendCode: 'const ctx = new AudioContext(); const buffer = createRainBuffer(ctx); noise.start();',
    apiEndpoint: 'Client-Side HTML5 Web Audio API (Zero backend call required)',
    backendLogic: 'Executes mathematical pink/brown noise IIR filtering directly in WebGL/Browser AudioThread.',
    databaseModel: 'DeepWorkSession.ambientSound & DeepWorkSession.ambientVolume field persistence.',
    failureCases: ['Browser autoplay policy restriction handled via user interaction gesture wrapper']
  }
];
