// by nichxbt
import * as React from 'react';
import { Accordion } from '@base-ui/react/accordion';
import { Select } from '@base-ui/react/select';
import type { UseAgentReturn } from '../../lib/useAgent';
import { parseListInput } from '../../lib/format';
import { sendMessage } from '../../lib/rpc';

const PROVIDERS = [
  { value: 'xai-oauth', label: 'Grok (xAI OAuth)' },
  { value: 'xai', label: 'Grok (API key)' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'ollama', label: 'Ollama' },
];

const MODELS = ['grok-4.5', 'grok-4-5-medium', 'grok-4.3', 'grok-build-0.1'];

export function ConfigPanel({ agent }: { agent: UseAgentReturn }) {
  const { llm, persona, safety, oauth, oauthDevice, testResult, saveConfig, startOauth, logoutOauth, testLlm } = agent;
  const [apiKey, setApiKey] = React.useState(llm.apiKey || '');
  const [model, setModel] = React.useState(llm.model || 'grok-4.5');
  const [customModel, setCustomModel] = React.useState(!MODELS.includes(llm.model || ''));
  const [baseUrl, setBaseUrl] = React.useState(llm.baseUrl || '');
  const [personaDraft, setPersonaDraft] = React.useState(persona);
  const [maxActions, setMaxActions] = React.useState(safety.maxActionsPerTurn ?? 20);

  React.useEffect(() => setPersonaDraft(persona), [persona]);

  const commitLlm = (patch: Partial<typeof llm>) => {
    const next = { ...llm, apiKey, model, baseUrl, ...patch };
    saveConfig({ llm: next });
  };

  return (
    <div className="xa-config-panel">
      <div className="xa-xai-banner">
        <div className="xa-xai-banner-title">Hai lớp đăng nhập</div>
        <div className="xa-xai-banner-desc">x.com = cookie trình duyệt · Grok = OAuth xAI (SuperGrok / Premium+)</div>
      </div>

      <div className="xa-oauth-box">
        <div className="xa-oauth-status">
          {oauth.signedIn ? `Đã đăng nhập${oauth.email ? ` · ${oauth.email}` : ''}` : 'Chưa đăng nhập xAI'}
        </div>
        <div className="xa-oauth-actions">
          {!oauth.signedIn ? (
            <button type="button" className="xa-btn-primary xa-btn-block" onClick={startOauth}>
              Đăng nhập xAI
            </button>
          ) : (
            <button type="button" className="xa-btn-secondary" onClick={logoutOauth}>
              Đăng xuất
            </button>
          )}
          <button type="button" className="xa-btn-secondary" onClick={() => testLlm()}>
            Test Grok
          </button>
        </div>

        {oauthDevice && (
          <div className="xa-oauth-device">
            <div className="xa-code-label">Mã xác nhận</div>
            <div className="xa-user-code">{oauthDevice.userCode}</div>
            <div className="xa-oauth-hint">Duyệt quyền trên sidebar bên phải…</div>
            <button
              type="button"
              className="xa-btn-link"
              onClick={() => sendMessage({ type: 'XAI_OAUTH_OPEN_PANEL' })}
            >
              Mở lại sidebar đăng nhập →
            </button>
          </div>
        )}

        {testResult && (
          <div className={`xa-test-result ${testResult.ok ? 'is-ok' : 'is-error'}`}>{testResult.message}</div>
        )}
      </div>

      <Accordion.Root className="xa-advanced">
        <Accordion.Item>
          <Accordion.Header>
            <Accordion.Trigger className="xa-advanced-summary">Model &amp; persona</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel className="xa-advanced-body">
            <label className="xa-field">
              <span className="xa-field-label">Provider</span>
              <Select.Root value={llm.provider} onValueChange={(v) => commitLlm({ provider: v as typeof llm.provider })}>
                <Select.Trigger className="xa-select-trigger">
                  <Select.Value />
                  <Select.Icon className="xa-select-icon">▾</Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Positioner className="xa-select-positioner">
                    <Select.Popup className="xa-select-popup">
                      {PROVIDERS.map((p) => (
                        <Select.Item key={p.value} value={p.value} className="xa-select-item">
                          <Select.ItemText>{p.label}</Select.ItemText>
                          <Select.ItemIndicator className="xa-select-item-indicator">✓</Select.ItemIndicator>
                        </Select.Item>
                      ))}
                    </Select.Popup>
                  </Select.Positioner>
                </Select.Portal>
              </Select.Root>
            </label>

            {llm.provider !== 'xai-oauth' && (
              <label className="xa-field">
                <span className="xa-field-label">API key</span>
                <input
                  type="password"
                  className="xa-input"
                  placeholder="Optional"
                  autoComplete="off"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  onBlur={() => commitLlm({})}
                />
              </label>
            )}

            <label className="xa-field">
              <span className="xa-field-label">Model</span>
              <Select.Root
                value={customModel ? 'custom' : model}
                onValueChange={(v) => {
                  if (!v) return;
                  if (v === 'custom') {
                    setCustomModel(true);
                    return;
                  }
                  setCustomModel(false);
                  setModel(v);
                  commitLlm({ model: v });
                }}
              >
                <Select.Trigger className="xa-select-trigger">
                  <Select.Value />
                  <Select.Icon className="xa-select-icon">▾</Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Positioner className="xa-select-positioner">
                    <Select.Popup className="xa-select-popup">
                      {MODELS.map((m) => (
                        <Select.Item key={m} value={m} className="xa-select-item">
                          <Select.ItemText>{m}</Select.ItemText>
                          <Select.ItemIndicator className="xa-select-item-indicator">✓</Select.ItemIndicator>
                        </Select.Item>
                      ))}
                      <Select.Item value="custom" className="xa-select-item">
                        <Select.ItemText>Custom…</Select.ItemText>
                        <Select.ItemIndicator className="xa-select-item-indicator">✓</Select.ItemIndicator>
                      </Select.Item>
                    </Select.Popup>
                  </Select.Positioner>
                </Select.Portal>
              </Select.Root>
            </label>

            {customModel && (
              <label className="xa-field">
                <span className="xa-field-label">Custom model</span>
                <input
                  type="text"
                  className="xa-input"
                  placeholder="grok-4.5"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  onBlur={() => commitLlm({ model })}
                />
              </label>
            )}

            <label className="xa-field">
              <span className="xa-field-label">Base URL</span>
              <input
                type="text"
                className="xa-input"
                placeholder="optional"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                onBlur={() => commitLlm({})}
              />
            </label>

            <div className="xa-field-row">
              <label className="xa-field">
                <span className="xa-field-label">Persona</span>
                <input
                  type="text"
                  className="xa-input"
                  placeholder="XActions"
                  value={personaDraft.name || ''}
                  onChange={(e) => setPersonaDraft((p) => ({ ...p, name: e.target.value }))}
                />
              </label>
              <label className="xa-field">
                <span className="xa-field-label">Niche</span>
                <input
                  type="text"
                  className="xa-input"
                  placeholder="AI / SaaS"
                  value={personaDraft.niche || ''}
                  onChange={(e) => setPersonaDraft((p) => ({ ...p, niche: e.target.value }))}
                />
              </label>
            </div>

            <label className="xa-field">
              <span className="xa-field-label">Tone</span>
              <input
                type="text"
                className="xa-input"
                placeholder="rõ ràng, quyết đoán"
                value={personaDraft.tone || ''}
                onChange={(e) => setPersonaDraft((p) => ({ ...p, tone: e.target.value }))}
              />
            </label>

            <label className="xa-field">
              <span className="xa-field-label">Expertise</span>
              <input
                type="text"
                className="xa-input"
                placeholder="growth, content"
                defaultValue={Array.isArray(personaDraft.expertise) ? personaDraft.expertise.join(', ') : personaDraft.expertise || ''}
                onBlur={(e) => setPersonaDraft((p) => ({ ...p, expertise: parseListInput(e.target.value) }))}
              />
            </label>

            <label className="xa-field">
              <span className="xa-field-label">Avoid</span>
              <input
                type="text"
                className="xa-input"
                placeholder="spam, bait"
                defaultValue={Array.isArray(personaDraft.avoid) ? personaDraft.avoid.join(', ') : personaDraft.avoid || ''}
                onBlur={(e) => setPersonaDraft((p) => ({ ...p, avoid: parseListInput(e.target.value) }))}
              />
            </label>

            <label className="xa-field">
              <span className="xa-field-label">Max actions / tool</span>
              <input
                type="number"
                className="xa-input"
                min={1}
                max={50}
                value={maxActions}
                onChange={(e) => setMaxActions(parseInt(e.target.value, 10) || 1)}
              />
            </label>

            <button
              type="button"
              className="xa-btn-secondary xa-btn-block"
              onClick={() =>
                saveConfig({
                  llm: { ...llm, apiKey, model, baseUrl },
                  persona: personaDraft,
                  safety: { ...safety, maxActionsPerTurn: maxActions },
                })
              }
            >
              Lưu cài đặt
            </button>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
    </div>
  );
}
