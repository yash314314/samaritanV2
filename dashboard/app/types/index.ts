export interface DeepWorkSession {
    id: string;
    goal: string | null;
    status: "active" | "completed" | "abandoned" | "expired";
    plannedMinutes: number;
    actualMinutes: number;
    startedAt: string;
    endedAt: string | null;
    enforcement: string;
    focusScore: number;
    productivityScore: number;
    violationCount: number;
    interruptionMs: number;
    productiveMs: number;
    distractionMs: number;
    idleMs: number;
  }
  
  export interface MinuteLog {
    minute: number;
    timestamp: string;
    focusScore: number;
    productivityScore: number;
    distraction: boolean;
    idle: boolean;
    appName: string | null;
    category: string | null;
  }
  
  export interface FocusIntervention {
    id: string;
    appName: string;
    windowTitle: string;
    domain: string | null;
    action: string;
    reason: string | null;
    detectedAt: string;
    durationMs: number;
  }
  
  export interface SessionResult {
    session: DeepWorkSession;
    metrics: {
      totalMinutes: number;
      productiveMinutes: number;
      distractionMinutes: number;
      idleMinutes: number;
      violationCount: number;
      interruptionMs: number;
      avgFocus: number;
      avgProductivity: number;
      peakFocus: number;
      peakProductivity: number;
      avgRecoveryMinutes: number;
      finalFocusScore: number;
      finalProductivityScore: number;
      completionRate: number;
    };
    timeSeries: MinuteLog[];
    interventions: FocusIntervention[];
  }
  
  export interface SparklineData {
    focus: number[];
    productivity: number[];
    status: ("focus" | "idle" | "distraction")[];
    minutesCount: number;
  }
  
  export interface HistorySession extends DeepWorkSession {
    sparkline: SparklineData;
    interventions: Pick<FocusIntervention, "id" | "appName" | "action" | "detectedAt">[];
  }
  
  export interface ActiveStatus {
    active: boolean;
    session?: {
      id: string;
      goal: string | null;
      plannedMinutes: number;
      elapsedMinutes: number;
      remainingMinutes: number;
      enforcement: string;
      focusScore: number;
      violationCount: number;
    };
  }
  
  // Analytics types
  export interface DailyMetrics {
    date: string;
    totalDuration: number;
    sessionCount: number;
    focusScore: number;
    productivityScore: number;
    deepWorkRatio: number;
    communicationRatio: number;
    fragmentationScore: number;
    energyScore: number;
    switchingRate: number;
    burnoutRisk: string;
    burnoutRiskScore: number;
    assistantSuggestion: string;
  }
  
  export interface TrendData {
    date: string;
    focus: number;
    entropy: number;
  }
  
  export interface IntentHeatmapItem {
    intent: string;
    percentage: number;
    avgFocus: number;
  }
  
  export interface AssistantInsights {
    productivityScore: number;
    focusScore: number;
    deepWorkRatio: number;
    communicationRatio: number;
    fragmentationScore: number;
    energyScore: number;
    dominantIntent: string;
    deepWorkSessions: number;
    avgFocusBlockMinutes: number;
    cognitiveStability: number;
    switchingRate: number;
    suggestion: string;
  }