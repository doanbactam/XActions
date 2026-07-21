// by nichxbt
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

  return (
    <section className="xa-playbook-wrap">
      <div className="xa-section-head">
        <h2 className="xa-h2">Kịch bản</h2>
        <div className="xa-section-actions">
          <button type="button" className="xa-btn-primary xa-btn-sm" disabled={busy} onClick={() => runPlaybook(false)}>
            Chạy đã chọn
          </button>
          <button
            type="button"
            className="xa-btn-secondary xa-btn-sm"
            title="Gồm bước cần xác nhận"
            disabled={busy}
            onClick={() => runPlaybook(true)}
          >
            Force
          </button>
          <button type="button" className="xa-btn-quiet xa-btn-sm" disabled={busy} onClick={runStrategy}>
            Làm lại
          </button>
          <button type="button" className="xa-btn-quiet xa-btn-sm" onClick={clearPlaybook}>
            Xóa
          </button>
        </div>
      </div>

      {playbook?.playbook?.goal && <p className="xa-playbook-goal">{playbook.playbook.goal}</p>}

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
