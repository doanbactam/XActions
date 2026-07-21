// Playbook section — view, toggle, edit steps + run controls.
// by nichxbt
import * as React from 'react';
import { Checkbox } from '@base-ui/react/checkbox';
import type { UseAgentReturn } from '../../popup/lib/useAgent';

const STATUS_ICON: Record<string, string> = {
  pending: '•', done: '✅', failed: '❌', skipped_confirm: '⏭', blocked: '⛔',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ', done: 'Xong', failed: 'Lỗi', skipped_confirm: 'Bỏ qua', blocked: 'Chặn',
};

export function PlaybookSection({ agent }: { agent: UseAgentReturn }) {
  const { playbook, busy, runPlaybook, runStrategy, clearPlaybook, updateSteps } = agent;
  const steps = playbook?.playbook?.steps ?? [];
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const doneCount = steps.filter((s) => s.status === 'done').length;
  const failedCount = steps.filter((s) => s.status === 'failed').length;
  const enabledCount = steps.filter((s) => s.enabled !== false).length;

  if (!playbook) {
    return (
      <div className="xa-dash-empty">
        <p style={{ marginBottom: 16 }}>Chưa có kịch bản. Chạy phân tích từ popup hoặc bấm bên dưới.</p>
        <button type="button" className="xa-dash-btn xa-dash-btn-primary" disabled={busy} onClick={runStrategy}>
          {busy ? 'Đang phân tích…' : 'Phân tích tài khoản'}
        </button>
      </div>
    );
  }

  const toggleAll = (enabled: boolean) => {
    updateSteps(steps.map((s) => ({ id: s.id, enabled })));
  };

  return (
    <div>
      {/* Summary card */}
      <div className="xa-dash-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="xa-dash-card-title" style={{ marginBottom: 4 }}>Kịch bản</div>
            {playbook.playbook.goal && (
              <p style={{ fontSize: 13, color: 'var(--xa-ink-2)', maxWidth: 500 }}>{playbook.playbook.goal}</p>
            )}
            <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 12, color: 'var(--xa-ink-3)' }}>
              <span>📊 {steps.length} bước</span>
              <span>✅ {doneCount} done</span>
              {failedCount > 0 && <span style={{ color: 'var(--xa-danger)' }}>❌ {failedCount} lỗi</span>}
              <span>☑ {enabledCount} bật</span>
              {playbook.playbook.riskLevel && <span>🛡 {playbook.playbook.riskLevel}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="xa-dash-btn xa-dash-btn-primary" disabled={busy} onClick={() => runPlaybook(false)}>
              {busy ? 'Đang chạy…' : 'Chạy đã chọn'}
            </button>
            <button type="button" className="xa-dash-btn xa-dash-btn-secondary" disabled={busy} onClick={() => runPlaybook(true)}>
              Force tất cả
            </button>
            <button type="button" className="xa-dash-btn xa-dash-btn-secondary" disabled={busy} onClick={runStrategy}>
              Phân tích lại
            </button>
            <button type="button" className="xa-dash-btn xa-dash-btn-danger" onClick={clearPlaybook}>
              Xóa
            </button>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="xa-dash-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="xa-dash-card-title" style={{ margin: 0 }}>Các bước</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="xa-dash-btn xa-dash-btn-secondary" onClick={() => toggleAll(true)} style={{ padding: '6px 12px', fontSize: 12 }}>
              Bật tất cả
            </button>
            <button type="button" className="xa-dash-btn xa-dash-btn-secondary" onClick={() => toggleAll(false)} style={{ padding: '6px 12px', fontSize: 12 }}>
              Tắt tất cả
            </button>
          </div>
        </div>

        {steps.length === 0 ? (
          <div className="xa-dash-empty">Chưa có bước nào.</div>
        ) : (
          steps.map((step, i) => (
            <div
              key={step.id}
              className={`xa-dash-step-row is-${step.status || 'pending'}`}
              onClick={() => setExpanded(expanded === step.id ? null : step.id)}
              style={{ cursor: 'pointer' }}
            >
              <Checkbox.Root
                checked={step.enabled !== false}
                onCheckedChange={(v) => updateSteps([{ id: step.id, enabled: !!v }])}
                className="xa-checkbox"
                onClick={(e) => e.stopPropagation()}
              >
                <Checkbox.Indicator className="xa-checkbox-indicator">✓</Checkbox.Indicator>
              </Checkbox.Root>

              <div>
                <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--xa-ink-3)', fontSize: 11 }}>{i + 1}.</span>
                  {step.title}
                  {step.requiresConfirm && (
                    <span className="xa-step-confirm-tag">cần xác nhận</span>
                  )}
                </div>
                {step.reason && <div style={{ fontSize: 11, color: 'var(--xa-ink-3)', marginTop: 2 }}>{step.reason}</div>}
                {expanded === step.id && step.args && (
                  <pre style={{ marginTop: 8, fontSize: 11, color: 'var(--xa-ink-3)', background: 'var(--xa-bg)', padding: 8, borderRadius: 4, overflow: 'auto' }}>
                    {JSON.stringify(step.args, null, 2)}
                  </pre>
                )}
              </div>

              <span className="xa-dash-step-tool">{step.tool}</span>
              <span className="xa-dash-step-status" title={step.status}>
                {STATUS_ICON[step.status || 'pending']} {STATUS_LABEL[step.status || 'pending']}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Metadata */}
      {(playbook.account || playbook.createdAt || playbook.model) && (
        <div className="xa-dash-card">
          <div className="xa-dash-card-title">Metadata</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12, color: 'var(--xa-ink-2)' }}>
            {playbook.account?.handle && <div><strong>Account:</strong> @{playbook.account.handle}</div>}
            {playbook.model && <div><strong>Model:</strong> {playbook.model}</div>}
            {playbook.createdAt && <div><strong>Created:</strong> {new Date(playbook.createdAt).toLocaleString()}</div>}
            {playbook.lastRunAt && <div><strong>Last run:</strong> {new Date(playbook.lastRunAt).toLocaleString()}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
