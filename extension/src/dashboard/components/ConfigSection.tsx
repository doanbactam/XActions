// Config section — full 11-field config (OAuth, provider, model, persona, safety).
// by nichxbt
import * as React from 'react';
import { Select } from '@base-ui/react/select';
import type { UseAgentReturn } from '../../popup/lib/useAgent';
import { parseListInput } from '../../popup/lib/format';
import { sendMessage } from '../../popup/lib/rpc';

const PROVIDERS = [
  { value: 'xai-oauth', label: 'Grok (xAI OAuth)' },
  { value: 'xai', label: 'Grok (API key)' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'ollama', label: 'Ollama' },
];

const MODELS = ['grok-4.5', 'grok-4-5-medium', 'grok-4.3', 'grok-build-0.1'];

export function ConfigSection({ agent }: { agent: UseAgentReturn }) {
  const { llm, persona, safety, oauth, oauthDevice, testResult, saveConfig, startOauth, logoutOauth, testLlm } = agent;
  const [apiKey, setApiKey] = React.useState(llm.apiKey || '');
  const [baseUrl, setBaseUrl] = React.useState(llm.baseUrl || '');
  const [model, setModel] = React.useState(llm.model || 'grok-4.5');
  const [customModel, setCustomModel] = React.useState(!MODELS.includes(llm.model || ''));
  const [personaDraft, setPersonaDraft] = React.useState(persona);
  const [maxActions, setMaxActions] = React.useState(safety.maxActionsPerTurn ?? 20);
  const [requireConfirm, setRequireConfirm] = React.useState(safety.requireConfirmHighRisk ?? true);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);

  React.useEffect(() => setPersonaDraft(persona), [persona]);

  const commitLlm = (patch: Partial<typeof llm>) => {
    const next = { ...llm, apiKey, model, baseUrl, ...patch };
    saveConfig({ llm: next });
  };

  const saveAll = () => {
    saveConfig({
      llm: { ...llm, apiKey, model, baseUrl },
      persona: personaDraft,
      safety: { ...safety, maxActionsPerTurn: maxActions, requireConfirmHighRisk: requireConfirm },
    });
    setSavedAt(Date.now());
  };

  return (
    <div>
      {/* OAuth card */}
      <div className="xa-dash-card">
        <div className="xa-dash-card-title">xAI OAuth</div>
        <p className="xa-dash-field-hint" style={{ marginBottom: 12 }}>
          Đăng nhập xAI (SuperGrok / Premium+) để dùng Grok mà không cần API key.
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: oauth.signedIn ? 'var(--xa-success)' : 'var(--xa-ink-3)' }}>
            {oauth.signedIn ? `✅ Đã đăng nhập${oauth.email ? ` · ${oauth.email}` : ''}` : '⏳ Chưa đăng nhập'}
          </span>
          {!oauth.signedIn ? (
            <button type="button" className="xa-dash-btn xa-dash-btn-primary" onClick={startOauth}>
              Đăng nhập xAI
            </button>
          ) : (
            <button type="button" className="xa-dash-btn xa-dash-btn-secondary" onClick={logoutOauth}>
              Đăng xuất
            </button>
          )}
          <button type="button" className="xa-dash-btn xa-dash-btn-secondary" onClick={() => testLlm()}>
            Test Grok
          </button>
        </div>

        {oauthDevice && (
          <div className="xa-oauth-device" style={{ marginTop: 14 }}>
            <div className="xa-code-label">Mã xác nhận</div>
            <div className="xa-user-code">{oauthDevice.userCode}</div>
            <div className="xa-oauth-hint">Duyệt quyền trên sidebar bên phải…</div>
            <button type="button" className="xa-btn-link" onClick={() => sendMessage({ type: 'XAI_OAUTH_OPEN_PANEL' })}>
              Mở lại sidebar →
            </button>
          </div>
        )}

        {testResult && (
          <div className={`xa-test-result ${testResult.ok ? 'is-ok' : 'is-error'}`} style={{ marginTop: 12 }}>
            {testResult.message}
          </div>
        )}
      </div>

      {/* LLM config card */}
      <div className="xa-dash-card">
        <div className="xa-dash-card-title">Model & Provider</div>

        <div className="xa-dash-grid-2">
          <label className="xa-dash-field">
            <span className="xa-dash-field-label">Provider</span>
            <Select.Root value={llm.provider} onValueChange={(v) => v && commitLlm({ provider: v as typeof llm.provider })}>
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

          <label className="xa-dash-field">
            <span className="xa-dash-field-label">Model</span>
            <Select.Root
              value={customModel ? 'custom' : model}
              onValueChange={(v) => {
                if (!v) return;
                if (v === 'custom') { setCustomModel(true); return; }
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
        </div>

        {customModel && (
          <label className="xa-dash-field">
            <span className="xa-dash-field-label">Custom model</span>
            <input className="xa-dash-input" placeholder="grok-4.5" value={model} onChange={(e) => setModel(e.target.value)} onBlur={() => commitLlm({ model })} />
          </label>
        )}

        {llm.provider !== 'xai-oauth' && (
          <label className="xa-dash-field">
            <span className="xa-dash-field-label">API key</span>
            <input type="password" className="xa-dash-input" placeholder="xai-…" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} onBlur={() => commitLlm({})} />
          </label>
        )}

        <label className="xa-dash-field">
          <span className="xa-dash-field-label">Base URL</span>
          <span className="xa-dash-field-hint">Optional — cho OpenRouter / Ollama / proxy</span>
          <input className="xa-dash-input" placeholder="http://localhost:11434" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} onBlur={() => commitLlm({})} />
        </label>
      </div>

      {/* Persona card */}
      <div className="xa-dash-card">
        <div className="xa-dash-card-title">Persona</div>

        <div className="xa-dash-grid-2">
          <label className="xa-dash-field">
            <span className="xa-dash-field-label">Tên</span>
            <input className="xa-dash-input" placeholder="XActions" value={personaDraft.name || ''} onChange={(e) => setPersonaDraft((p) => ({ ...p, name: e.target.value }))} />
          </label>
          <label className="xa-dash-field">
            <span className="xa-dash-field-label">Niche</span>
            <input className="xa-dash-input" placeholder="AI / SaaS" value={personaDraft.niche || ''} onChange={(e) => setPersonaDraft((p) => ({ ...p, niche: e.target.value }))} />
          </label>
        </div>

        <label className="xa-dash-field">
          <span className="xa-dash-field-label">Tone</span>
          <input className="xa-dash-input" placeholder="rõ ràng, quyết đoán" value={personaDraft.tone || ''} onChange={(e) => setPersonaDraft((p) => ({ ...p, tone: e.target.value }))} />
        </label>

        <label className="xa-dash-field">
          <span className="xa-dash-field-label">Expertise</span>
          <span className="xa-dash-field-hint">Phân tách bằng dấu phẩy</span>
          <input
            className="xa-dash-input"
            placeholder="growth, content, analytics"
            defaultValue={Array.isArray(personaDraft.expertise) ? personaDraft.expertise.join(', ') : personaDraft.expertise || ''}
            onBlur={(e) => setPersonaDraft((p) => ({ ...p, expertise: parseListInput(e.target.value) }))}
          />
        </label>

        <label className="xa-dash-field">
          <span className="xa-dash-field-label">Avoid</span>
          <input
            className="xa-dash-input"
            placeholder="spam, bait, controversial"
            defaultValue={Array.isArray(personaDraft.avoid) ? personaDraft.avoid.join(', ') : personaDraft.avoid || ''}
            onBlur={(e) => setPersonaDraft((p) => ({ ...p, avoid: parseListInput(e.target.value) }))}
          />
        </label>

        <label className="xa-dash-field">
          <span className="xa-dash-field-label">Opinions</span>
          <span className="xa-dash-field-hint">Chủ đề persona có quan điểm rõ</span>
          <input
            className="xa-dash-input"
            placeholder="open-source wins, AI augments not replaces"
            defaultValue={Array.isArray(personaDraft.opinions) ? personaDraft.opinions.join(', ') : personaDraft.opinions || ''}
            onBlur={(e) => setPersonaDraft((p) => ({ ...p, opinions: parseListInput(e.target.value) }))}
          />
        </label>
      </div>

      {/* Safety card */}
      <div className="xa-dash-card">
        <div className="xa-dash-card-title">Safety caps</div>

        <div className="xa-dash-grid-2">
          <label className="xa-dash-field">
            <span className="xa-dash-field-label">Max actions / tool call</span>
            <span className="xa-dash-field-hint">Giới hạn số action mỗi lần Agent gọi tool</span>
            <input type="number" className="xa-dash-input" min={1} max={50} value={maxActions} onChange={(e) => setMaxActions(parseInt(e.target.value, 10) || 1)} />
          </label>

          <label className="xa-dash-field">
            <span className="xa-dash-field-label">Require confirm (high risk)</span>
            <span className="xa-dash-field-hint">Bước high-risk cần xác nhận trước khi chạy</span>
            <select className="xa-dash-input" value={requireConfirm ? 'yes' : 'no'} onChange={(e) => setRequireConfirm(e.target.value === 'yes')}>
              <option value="yes">Có — hỏi trước</option>
              <option value="no">Không — chạy luôn</option>
            </select>
          </label>
        </div>
      </div>

      {/* Save bar */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
        <button type="button" className="xa-dash-btn xa-dash-btn-primary" onClick={saveAll}>
          Lưu tất cả
        </button>
        {savedAt && <span style={{ fontSize: 12, color: 'var(--xa-success)' }}>✅ Đã lưu {new Date(savedAt).toLocaleTimeString()}</span>}
      </div>
    </div>
  );
}
