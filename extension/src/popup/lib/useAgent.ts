// Encapsulates all Strategist/Agent runtime state — the TS/React counterpart
// of popup/agent-ui.js. Talks to the exact same background message contract.
// by nichxbt

import * as React from 'react';
import { sendMessage } from './rpc';
import type {
  AgentChatMessage,
  AgentConfigResponse,
  AgentLlmConfig,
  AgentOauthInfo,
  AgentPersonaConfig,
  AgentPlaybookEnvelope,
  AgentSafetyConfig,
  AgentStage,
} from '../types';

interface OauthDeviceState {
  userCode: string;
  verificationUri: string;
  verificationUriComplete?: string;
  interval: number;
}

export function useAgent() {
  const [llm, setLlm] = React.useState<AgentLlmConfig>({ provider: 'xai-oauth', model: 'grok-4.5' });
  const [persona, setPersona] = React.useState<AgentPersonaConfig>({ name: 'XActions' });
  const [safety, setSafety] = React.useState<AgentSafetyConfig>({ maxActionsPerTurn: 20 });
  const [history, setHistory] = React.useState<AgentChatMessage[]>([]);
  const [oauth, setOauth] = React.useState<AgentOauthInfo>({ signedIn: false });
  const [oauthDevice, setOauthDevice] = React.useState<OauthDeviceState | null>(null);
  const [testResult, setTestResult] = React.useState<{ ok: boolean; message: string } | null>(null);
  const [playbook, setPlaybook] = React.useState<AgentPlaybookEnvelope | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [stage, setStage] = React.useState<AgentStage>('setup');
  const [statusLine, setStatusLine] = React.useState('Sẵn sàng phân tích');
  const [strategyError, setStrategyError] = React.useState<string | null>(null);
  const pollTimer = React.useRef<number | null>(null);

  const loadConfig = React.useCallback(async () => {
    const res = await sendMessage<AgentConfigResponse>({ type: 'AGENT_GET_CONFIG' });
    if (res?.success) {
      if (res.llm) setLlm(res.llm);
      if (res.persona) setPersona(res.persona);
      if (res.safety) setSafety(res.safety);
      if (res.history) setHistory(res.history);
      if (res.oauth) setOauth(res.oauth);
      if (res.oauth?.signedIn) setStage((s) => (s === 'setup' ? 'analyze' : s));
    }
  }, []);

  const loadPlaybook = React.useCallback(async () => {
    const res = await sendMessage<{ ok: boolean; playbook?: AgentPlaybookEnvelope }>({ type: 'AGENT_GET_PLAYBOOK' });
    if (res?.ok && res.playbook) {
      setPlaybook(res.playbook);
      setStage('playbook');
    }
  }, []);

  React.useEffect(() => {
    loadConfig();
    loadPlaybook();
    return () => {
      if (pollTimer.current) window.clearTimeout(pollTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveConfig = React.useCallback(
    async (patch: { llm?: AgentLlmConfig; persona?: AgentPersonaConfig; safety?: AgentSafetyConfig }) => {
      await sendMessage({ type: 'AGENT_SAVE_CONFIG', config: patch });
      if (patch.llm) setLlm(patch.llm);
      if (patch.persona) setPersona(patch.persona);
      if (patch.safety) setSafety(patch.safety);
    },
    [],
  );

  const startOauth = React.useCallback(async () => {
    const res = await sendMessage<{
      success: boolean;
      user_code?: string;
      verification_uri?: string;
      verification_uri_complete?: string;
      interval?: number;
      error?: string;
    }>({ type: 'XAI_OAUTH_START' });
    if (!res?.success) {
      setTestResult({ ok: false, message: res?.error || 'Không thể bắt đầu đăng nhập xAI' });
      return;
    }
    setOauthDevice({
      userCode: res.user_code || '————',
      verificationUri: res.verification_uri || '',
      verificationUriComplete: res.verification_uri_complete,
      interval: (res.interval || 5) * 1000,
    });
    const poll = async () => {
      const p = await sendMessage<{ status: string; error?: string }>({ type: 'XAI_OAUTH_POLL' });
      if (p.status === 'success') {
        setOauthDevice(null);
        await loadConfig();
        setStage('analyze');
        return;
      }
      if (p.status === 'pending') {
        pollTimer.current = window.setTimeout(poll, (res.interval || 5) * 1000);
        return;
      }
      setOauthDevice(null);
      setTestResult({ ok: false, message: p.error || 'Đăng nhập xAI thất bại' });
    };
    pollTimer.current = window.setTimeout(poll, (res.interval || 5) * 1000);
  }, [loadConfig]);

  const logoutOauth = React.useCallback(async () => {
    await sendMessage({ type: 'XAI_OAUTH_LOGOUT' });
    setOauth({ signedIn: false });
  }, []);

  const testLlm = React.useCallback(async (configOverride?: Partial<AgentLlmConfig>) => {
    const res = await sendMessage<{ ok: boolean; model?: string; error?: string }>({
      type: 'AGENT_TEST_LLM',
      config: configOverride,
    });
    setTestResult(res.ok ? { ok: true, message: `OK · ${res.model}` } : { ok: false, message: res.error || 'Test thất bại' });
    return res;
  }, []);

  const runStrategy = React.useCallback(async () => {
    setBusy(true);
    setStrategyError(null);
    setStage('analyze');
    setStatusLine('Grok đang phân tích tài khoản…');
    try {
      const res = await sendMessage<{ ok: boolean; playbook?: AgentPlaybookEnvelope; error?: string }>({
        type: 'AGENT_RUN_STRATEGY',
      });
      if (res?.ok && res.playbook) {
        setPlaybook(res.playbook);
        setStage('playbook');
        setStatusLine('Kịch bản đã sẵn sàng');
      } else {
        setStrategyError(res?.error || 'Phân tích thất bại');
        setStatusLine('Phân tích lỗi — thử lại');
      }
    } finally {
      setBusy(false);
    }
  }, []);

  const runPlaybook = React.useCallback(async (force: boolean) => {
    setBusy(true);
    setStage('run');
    setStatusLine(force ? 'Đang chạy kịch bản (force)…' : 'Đang chạy kịch bản…');
    try {
      const res = await sendMessage<{ ok: boolean; playbook?: AgentPlaybookEnvelope; summary?: string; error?: string }>({
        type: 'AGENT_EXECUTE_PLAYBOOK',
        force,
      });
      if (res?.ok) {
        if (res.playbook) setPlaybook(res.playbook);
        setStatusLine(res.summary || 'Đã chạy kịch bản');
      } else {
        setStrategyError(res?.error || 'Chạy kịch bản thất bại');
      }
      return res;
    } finally {
      setBusy(false);
    }
  }, []);

  const clearPlaybook = React.useCallback(async () => {
    await sendMessage({ type: 'AGENT_CLEAR_PLAYBOOK' });
    setPlaybook(null);
    setStage('analyze');
    setStatusLine('Sẵn sàng phân tích');
  }, []);

  const updateSteps = React.useCallback(async (updates: { id: string; enabled?: boolean }[]) => {
    const res = await sendMessage<{ ok: boolean; playbook?: AgentPlaybookEnvelope }>({
      type: 'AGENT_UPDATE_STEPS',
      updates,
    });
    if (res?.ok && res.playbook) setPlaybook(res.playbook);
  }, []);

  const sendChat = React.useCallback(async (userMessage: string) => {
    setHistory((prev) => [...prev, { role: 'user', content: userMessage, time: Date.now() }]);
    setBusy(true);
    try {
      const res = await sendMessage<{ ok: boolean; content?: string; error?: string }>({
        type: 'AGENT_CHAT',
        userMessage,
      });
      setHistory((prev) => [
        ...prev,
        { role: 'assistant', content: res?.ok ? res.content || '' : `❌ ${res?.error || 'Lỗi'}`, time: Date.now() },
      ]);
    } finally {
      setBusy(false);
    }
  }, []);

  const clearHistory = React.useCallback(async () => {
    await sendMessage({ type: 'AGENT_CLEAR_HISTORY' });
    setHistory([]);
  }, []);

  return {
    llm,
    persona,
    safety,
    history,
    oauth,
    oauthDevice,
    testResult,
    playbook,
    busy,
    stage,
    statusLine,
    strategyError,
    saveConfig,
    startOauth,
    logoutOauth,
    testLlm,
    runStrategy,
    runPlaybook,
    clearPlaybook,
    updateSteps,
    sendChat,
    clearHistory,
  };
}

export type UseAgentReturn = ReturnType<typeof useAgent>;
