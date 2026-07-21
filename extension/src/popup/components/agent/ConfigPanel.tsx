// by nichxbt
import * as React from 'react';
import { Select } from '@base-ui/react/select';
import type { UseAgentReturn } from '../../lib/useAgent';
import { sendMessage } from '../../lib/rpc';

const MODELS = ['grok-4.5', 'grok-4-5-medium', 'grok-4.3', 'grok-build-0.1'];

export function ConfigPanel({ agent }: { agent: UseAgentReturn }) {
  const { llm, oauth, oauthDevice, testResult, saveConfig, startOauth, logoutOauth, testLlm } = agent;
  const [model, setModel] = React.useState(llm.model || 'grok-4.5');
  const [customModel, setCustomModel] = React.useState(!MODELS.includes(llm.model || ''));

  const commitModel = (m: string) => {
    setModel(m);
    saveConfig({ llm: { ...llm, model: m } });
  };

  return (
    <div className="xa-config-panel">
      {/* OAuth — luôn hiện */}
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

      {/* Model — chỉ 1 select + custom input */}
      <label className="xa-field" style={{ marginTop: 10 }}>
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
            commitModel(v);
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
            onBlur={() => commitModel(model)}
          />
        </label>
      )}
    </div>
  );
}
