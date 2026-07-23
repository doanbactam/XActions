// Shared types for the XActions popup UI.
// Mirrors the runtime message contract implemented in background/service-worker.js.
// by nichxbt

export type ToastKind = 'success' | 'error' | 'warning' | 'info';

export type LogType = 'action' | 'start' | 'stop' | 'complete' | 'error';

export interface ActivityEntry {
  time: number;
  type: LogType;
  automation: string;
  message: string;
}

export interface AutomationRuntimeState {
  running: boolean;
  actionCount?: number;
  startedAt?: number;
}

export type AutomationsState = Record<string, AutomationRuntimeState>;

export interface GlobalSettings {
  minDelay: number;
  maxDelay: number;
  debug: boolean;
}

export interface AccountInfo {
  name?: string;
  handle?: string;
  avatar?: string;
  url?: string;
}

// ---- Agent / Strategist ----

export type PlaybookStepStatus =
  | 'pending'
  | 'running'
  | 'done'
  | 'failed'
  | 'skipped_confirm'
  | 'blocked';

export type StepRisk = 'low' | 'medium' | 'high' | 'critical';

export interface PlaybookStep {
  id: string;
  phase?: string;
  title: string;
  tool: string;
  args?: Record<string, unknown>;
  reason?: string;
  requiresConfirm?: boolean;
  enabled?: boolean;
  status?: PlaybookStepStatus;
  lastResult?: unknown;
  risk?: StepRisk | string;
  safetyNotes?: string[];
}

export interface PlaybookData {
  goal?: string;
  horizon?: string;
  riskLevel?: 'conservative' | 'moderate' | 'aggressive';
  dailyCaps?: Record<string, number>;
  phases?: unknown[];
  contentCalendar?: unknown[];
  successMetrics?: string[];
  steps: PlaybookStep[];
  rejectedSteps?: unknown[];
}

export interface SafetyAnalysis {
  overallRisk?: 'low' | 'medium' | 'high' | string;
  score?: number;
  riskLevel?: 'conservative' | 'moderate' | 'aggressive' | string;
  accountFactors?: string[];
  actionRisks?: { tool: string; risk: string; why: string }[];
  recommendedCaps?: {
    likes?: number;
    follows?: number;
    unfollows?: number;
    replies?: number;
    maxActionsPerTurn?: number;
  };
  guardrails?: string[];
  disabledTools?: string[];
  summaryVi?: string;
  analyzedAt?: number;
  source?: string;
  accountStats?: {
    followers?: number | null;
    following?: number | null;
    sampleTweets?: number;
    gatherErrors?: number;
  };
  pressure?: number;
}

export interface AgentPlaybookEnvelope {
  version?: number;
  createdAt?: number;
  account?: { handle?: string; name?: string; stats?: Record<string, unknown> };
  analysis?: Record<string, unknown>;
  playbook: PlaybookData;
  executiveBrief?: string;
  signals?: Record<string, unknown>;
  model?: string;
  briefMarkdown?: string;
  lastRunAt?: number;
  safetyAnalysis?: SafetyAnalysis | null;
}

export type AgentStage = 'setup' | 'analyze' | 'playbook' | 'run';

export interface AgentLlmConfig {
  provider: 'xai-oauth' | 'xai' | 'openrouter' | 'openai' | 'ollama';
  authMode?: 'oauth' | 'api_key';
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

export interface AgentPersonaConfig {
  name?: string;
  tone?: string;
  niche?: string;
  expertise?: string[] | string;
  opinions?: string[] | string;
  avoid?: string[] | string;
}

export interface AgentSafetyConfig {
  maxActionsPerTurn?: number;
  requireConfirmHighRisk?: boolean;
}

export interface AgentChatMessage {
  role: 'user' | 'assistant';
  content: string;
  time?: number;
  toolTrace?: unknown[];
}

export interface AgentOauthInfo {
  signedIn: boolean;
  expires_at?: number;
  expired?: boolean;
  email?: string;
}

export interface AgentConfigResponse {
  success: boolean;
  llm?: AgentLlmConfig;
  persona?: AgentPersonaConfig;
  safety?: AgentSafetyConfig;
  history?: AgentChatMessage[];
  busy?: boolean;
  oauth?: AgentOauthInfo;
  toolCount?: number;
}

export interface AgentBackgroundConfig {
  backgroundMode: boolean;
  schedule: AgentScheduleConfig | null;
}

export interface AgentScheduleConfig {
  enabled: boolean;
  intervalMinutes: number;
  nextRunAt: number | null;
}

export interface AgentStrategyProgress {
  phase: AgentStage | 'idle' | 'done';
  label: string;
  at: number;
  tool?: string;
}
