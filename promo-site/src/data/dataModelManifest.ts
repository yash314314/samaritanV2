export interface PrismaEntity {
  name: string;
  tableName: string;
  description: string;
  fields: { name: string; type: string; isId?: boolean; isRelation?: boolean; desc: string }[];
  relations: string[];
}

export const DATA_MODEL_MANIFEST: PrismaEntity[] = [
  {
    name: 'Session',
    tableName: 'Session',
    description: 'Represents a continuous work tracking session containing focus, entropy, and burnout metrics.',
    fields: [
      { name: 'id', type: 'String (UUID)', isId: true, desc: 'Primary key' },
      { name: 'userId', type: 'String', desc: 'Owner user UUID' },
      { name: 'startTime', type: 'DateTime', desc: 'Session start timestamp' },
      { name: 'endTime', type: 'DateTime?', desc: 'Session end timestamp' },
      { name: 'focusScore', type: 'Float', desc: 'Duration-weighted focus score (0-100)' },
      { name: 'burnoutScore', type: 'Float', desc: 'Sustained load burnout risk index (0-1)' },
      { name: 'entropyScore', type: 'Float', desc: 'Attentional context switching entropy H(A)' },
      { name: 'switchCount', type: 'Int', desc: 'Total application window switches' }
    ],
    relations: ['User', 'Activity']
  },
  {
    name: 'Activity',
    tableName: 'Activity',
    description: 'Individual 500ms active window observation tick linked to a Session and optional Project.',
    fields: [
      { name: 'id', type: 'String (UUID)', isId: true, desc: 'Primary key' },
      { name: 'sessionId', type: 'String', isRelation: true, desc: 'Foreign key to Session' },
      { name: 'appName', type: 'String', desc: 'Executable name (e.g. Cursor.exe, chrome.exe)' },
      { name: 'windowTitle', type: 'String', desc: 'Active foreground window title string' },
      { name: 'duration', type: 'Int', desc: 'Observation interval duration in milliseconds' },
      { name: 'category', type: 'String?', desc: 'Classified category (coding, design, social_media)' },
      { name: 'intent', type: 'String?', desc: 'Intent classification (productive, neutral, distracting)' },
      { name: 'focusImpact', type: 'Float?', desc: 'Focus weight factor (0.0 to 1.0)' },
      { name: 'projectId', type: 'String?', isRelation: true, desc: 'Attributed project UUID' }
    ],
    relations: ['Session', 'Project', 'MeetingEvidence']
  },
  {
    name: 'DeepWorkSession',
    tableName: 'DeepWorkSession',
    description: 'Authoritative focus block session supporting countdown and Pomodoro rounds with process enforcement.',
    fields: [
      { name: 'id', type: 'String (UUID)', isId: true, desc: 'Primary key' },
      { name: 'userId', type: 'String', desc: 'Owner user UUID' },
      { name: 'plannedMinutes', type: 'Int', desc: 'Target focus duration in minutes' },
      { name: 'status', type: 'String', desc: 'Session status: active | completed | abandoned' },
      { name: 'enforcement', type: 'String', desc: 'Policy mode: observe | warn | require_reason | block' },
      { name: 'timerMode', type: 'String', desc: 'Timer mode: countdown | pomodoro' },
      { name: 'currentPhase', type: 'String', desc: 'Phase: focus | short_break | long_break' },
      { name: 'ambientSound', type: 'String', desc: 'Web Audio noise type: none | rain | pink | white | brown' },
      { name: 'allowedApps', type: 'String[]', desc: 'List of allowed application executables' },
      { name: 'blockedApps', type: 'String[]', desc: 'List of preemptively terminated applications' }
    ],
    relations: ['Project', 'FocusIntervention', 'DeepWorkMinuteLog', 'DeepWorkPhase']
  },
  {
    name: 'Project',
    tableName: 'Project',
    description: 'Project entity aggregating activity time, rules, calendar sessions, and weekly hour goals.',
    fields: [
      { name: 'id', type: 'String (UUID)', isId: true, desc: 'Primary key' },
      { name: 'userId', type: 'String', desc: 'Owner user UUID' },
      { name: 'name', type: 'String', desc: 'Project display name' },
      { name: 'color', type: 'String', desc: 'Hex color badge (e.g. #8b5cf6)' },
      { name: 'weeklyHourGoal', type: 'Float', desc: 'Target hours per week' },
      { name: 'active', type: 'Boolean', desc: 'Archive status flag' }
    ],
    relations: ['ProjectRule', 'ProjectTime', 'Activity', 'DeepWorkSession', 'Goal']
  },
  {
    name: 'ProjectRule',
    tableName: 'ProjectRule',
    description: 'Regex pattern rule for automated project time attribution based on app, domain, or title keyword.',
    fields: [
      { name: 'id', type: 'String (UUID)', isId: true, desc: 'Primary key' },
      { name: 'projectId', type: 'String', isRelation: true, desc: 'Foreign key to Project' },
      { name: 'appName', type: 'String?', desc: 'Matching executable name' },
      { name: 'domain', type: 'String?', desc: 'Matching domain string' },
      { name: 'titleKeyword', type: 'String?', desc: 'Regex or title keyword string' },
      { name: 'matchType', type: 'String', desc: 'Matching logic: exact | contains' }
    ],
    relations: ['Project']
  },
  {
    name: 'Goal',
    tableName: 'Goal',
    description: 'Weekly or daily goal target with streak tracking and automated pace forecasting.',
    fields: [
      { name: 'id', type: 'String (UUID)', isId: true, desc: 'Primary key' },
      { name: 'userId', type: 'String', desc: 'Owner user UUID' },
      { name: 'title', type: 'String', desc: 'Goal title' },
      { name: 'type', type: 'String', desc: 'Type: focus_minutes | project_time | focus_sessions' },
      { name: 'target', type: 'Float', desc: 'Target value (minutes, hours, count)' },
      { name: 'period', type: 'String', desc: 'Period: daily | weekly | monthly' },
      { name: 'streak', type: 'Int', desc: 'Consecutive completed periods streak counter' }
    ],
    relations: ['Project', 'GoalSnapshot']
  },
  {
    name: 'CalendarEvent',
    tableName: 'CalendarEvent',
    description: 'Scheduled calendar event supporting timeblocking, ICS imports, and focus auto-protection.',
    fields: [
      { name: 'id', type: 'String (UUID)', isId: true, desc: 'Primary key' },
      { name: 'userId', type: 'String', desc: 'Owner user UUID' },
      { name: 'title', type: 'String', desc: 'Event title' },
      { name: 'startAt', type: 'DateTime', desc: 'Scheduled start timestamp' },
      { name: 'endAt', type: 'DateTime', desc: 'Scheduled end timestamp' },
      { name: 'eventType', type: 'String', desc: 'Type: event | meeting | focus | break' },
      { name: 'focusAutoStart', type: 'Boolean', desc: 'Auto-triggers focus enforcement block' },
      { name: 'focusEnforcement', type: 'String', desc: 'Enforcement mode override' }
    ],
    relations: ['Project', 'CalendarSession', 'CalendarReminder']
  }
];
