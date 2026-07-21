// by nichxbt
import * as React from 'react';
import { Checkbox } from '@base-ui/react/checkbox';
import type { UseAgentReturn } from '../../lib/useAgent';

const STATUS_ICON: Record<string, string> = {
  pending: '•',
  done: '✅',
  failed: '❌',
  skipped_confirm: '⏭',
  blocked: '⛔',
};

export function PlaybookCard({ agent }: { agent: UseAgentReturn }) {
  const { playbook, busy, runPlaybook, runStrategy, clearPlaybook, updateSteps } = agent;
  const steps = playbook?.playbook?.steps ?? [];
  const [menuOpen, setMenuOpen] = React.useState(false);
  const doneCount = steps.filter((s) => s.status === 'done').length;
  const failedCount = steps.filter((s) => s.status === 'failed').length;

  return (
    <section className="xa-playbook-wrap">
      <div className="xa-section-head">
        <h2 className="xa-h2">Kịch bản</h2>
        <div className="xa-section-actions">
          <button
            type="button"
            className="xa-btn-primary xa-btn-sm"
            disabled={busy}
            onClick={() => runPlaybook(false)}
          >
            {busy ? 'Đang chạy…' : 'Chạy'}
          </button>
          <button
            type="button"
            className="xa-btn-quiet xa-btn-sm"
            title="Thêm tùy chọn"
            onClick={() => setMenuOpen((v) => !v)}
          >
            ⋯
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="xa-playbook-menu">
          <button type="button" className="xa-btn-quiet xa-btn-sm xa-btn-block" disabled={busy} onClick={() => { runPlaybook(true); setMenuOpen(false); }}>
            Chạy tất cả (force)
          </button>
          <button type="button" className="xa-btn-quiet xa-btn-sm xa-btn-block" disabled={busy} onClick={() => { runStrategy(); setMenuOpen(false); }}>
            Phân tích lại
          </button>
          <button type="button" className="xa-btn-quiet xa-btn-sm xa-btn-block" onClick={() => { clearPlaybook(); setMenuOpen(false); }}>
            Xóa kịch bản
          </button>
        </div>
      )}

      {playbook?.playbook?.goal && <p className="xa-playbook-goal">{playbook.playbook.goal}</p>}

      {steps.length > 0 && (
        <div className="xa-playbook-progress">
          {doneCount > 0 && <span className="xa-playbook-progress-done">✅ {doneCount}</span>}
          {failedCount > 0 && <span className="xa-playbook-progress-fail">❌ {failedCount}</span>}
          <span className="xa-playbook-progress-total">{doneCount}/{steps.length}</span>
        </div>
      )}

      <div className="xa-playbook-card">
        {steps.length === 0 ? (
          <div className="xa-playbook-empty">Chưa có bước nào.</div>
        ) : (
          <ul className="xa-step-list">
            {steps.map((step) => (
              <li key={step.id} className={`xa-step ${step.requiresConfirm ? 'needs-confirm' : ''}`}>
                <Checkbox.Root
                  checked={step.enabled !== false}
                  onCheckedChange={(v) => updateSteps([{ id: step.id, enabled: !!v }])}
                  className="xa-checkbox"
                >
                  <Checkbox.Indicator className="xa-checkbox-indicator">✓</Checkbox.Indicator>
                </Checkbox.Root>
                <div className="xa-step-body">
                  <div className="xa-step-title">
                    {step.title}
                    {step.requiresConfirm && <span className="xa-step-confirm-tag">cần xác nhận</span>}
                  </div>
                  {step.reason && <div className="xa-step-reason">{step.reason}</div>}
                </div>
                <span className="xa-step-status" title={step.status || 'pending'}>
                  {STATUS_ICON[step.status || 'pending'] || '•'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
