// by nichxbt
import * as React from 'react';
import { Checkbox } from '@base-ui/react/checkbox';
import type { UseAgentReturn } from '../../lib/useAgent';

const STATUS_ICON: Record<string, string> = {
  pending: '•',
  running: '◉',
  done: '✓',
  failed: '!',
  skipped_confirm: '⏭',
  blocked: '⛔',
};

export function PlaybookCard({ agent }: { agent: UseAgentReturn }) {
  const { playbook, busy, runPlaybook, runStrategy, clearPlaybook, updateSteps } = agent;
  const steps = playbook?.playbook?.steps ?? [];
  const sa = playbook?.safetyAnalysis;
  const [safetyOpen, setSafetyOpen] = React.useState(false);
  const [showDisabled, setShowDisabled] = React.useState(false);

  const enabledSteps = steps.filter((s) => s.enabled !== false);
  const disabledCount = steps.length - enabledSteps.length;
  const visibleSteps = showDisabled ? steps : enabledSteps;
  const doneCount = steps.filter((s) => s.status === 'done').length;
  const confirmCount = enabledSteps.filter((s) => s.requiresConfirm).length;
  const caps = sa?.recommendedCaps || playbook?.playbook?.dailyCaps;
  const riskLevel = playbook?.playbook?.riskLevel || sa?.riskLevel || 'moderate';

  return (
    <section className="xa-playbook-wrap">
      {/* Hero: goal + primary CTA */}
      <div className="xa-playbook-hero">
        <div className="xa-playbook-hero-text">
          <h2 className="xa-h2">Kịch bản</h2>
          {playbook?.playbook?.goal && (
            <p className="xa-playbook-goal" title={playbook.playbook.goal}>
              {playbook.playbook.goal}
            </p>
          )}
          <div className="xa-playbook-meta">
            <span className={`xa-meta-pill risk-${sa?.overallRisk || 'medium'}`}>
              {riskLevel}
              {sa?.score != null ? ` · ${sa.score}/10` : ''}
            </span>
            <span className="xa-meta-muted">
              {doneCount > 0 ? `${doneCount}/` : ''}
              {enabledSteps.length} bước
              {confirmCount > 0 ? ` · ${confirmCount} cần xác nhận` : ''}
            </span>
          </div>
        </div>
        <button
          type="button"
          className="xa-btn-primary xa-btn-sm"
          disabled={busy || enabledSteps.length === 0}
          onClick={() => runPlaybook(false)}
        >
          {busy ? '…' : 'Chạy'}
        </button>
      </div>

      {/* Secondary actions — one row, no ⋯ menu */}
      <div className="xa-playbook-actions">
        <button
          type="button"
          className="xa-btn-quiet xa-btn-sm"
          disabled={busy}
          title="Chạy cả bước cần xác nhận"
          onClick={() => runPlaybook(true)}
        >
          Force
        </button>
        <button type="button" className="xa-btn-quiet xa-btn-sm" disabled={busy} onClick={() => runStrategy()}>
          Phân tích lại
        </button>
        <button type="button" className="xa-btn-quiet xa-btn-sm" onClick={() => clearPlaybook()}>
          Xóa
        </button>
        {disabledCount > 0 && (
          <button
            type="button"
            className="xa-btn-quiet xa-btn-sm"
            onClick={() => setShowDisabled((v) => !v)}
          >
            {showDisabled ? 'Ẩn tắt' : `+${disabledCount} tắt`}
          </button>
        )}
      </div>

      {/* Safety — one compact line, expand for detail */}
      {sa && (
        <div className={`xa-safety-card risk-${sa.overallRisk || 'medium'}`}>
          <button type="button" className="xa-safety-head" onClick={() => setSafetyOpen((v) => !v)}>
            <span className="xa-safety-badge">🛡 Safety</span>
            <span className="xa-safety-one-line" title={sa.summaryVi || ''}>
              {sa.summaryVi || sa.overallRisk || '—'}
            </span>
            <span className="xa-safety-toggle">{safetyOpen ? '▾' : '▸'}</span>
          </button>
          {safetyOpen && (
            <div className="xa-safety-body">
              {caps && (
                <div className="xa-safety-caps">
                  <span>like {caps.likes ?? '—'}</span>
                  <span>follow {caps.follows ?? '—'}</span>
                  <span>unf {caps.unfollows ?? '—'}</span>
                  <span>reply {caps.replies ?? '—'}</span>
                  {caps.maxActionsPerTurn != null && <span>≤{caps.maxActionsPerTurn}/lượt</span>}
                </div>
              )}
              {(sa.guardrails?.length ?? 0) > 0 && (
                <ul className="xa-safety-guards">
                  {sa.guardrails!.slice(0, 3).map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* Steps — title + one badge max */}
      <div className="xa-playbook-card">
        {visibleSteps.length === 0 ? (
          <div className="xa-playbook-empty">
            {steps.length === 0 ? 'Chưa có bước nào.' : 'Mọi bước đang tắt — bật lại hoặc hiện bước tắt.'}
          </div>
        ) : (
          <ul className="xa-step-list">
            {visibleSteps.map((step) => {
              const needsConfirm = !!step.requiresConfirm;
              const highRisk = step.risk === 'high' || step.risk === 'critical';
              const isRunning = step.status === 'running';
              return (
                <li
                  key={step.id}
                  className={`xa-step ${needsConfirm ? 'needs-confirm' : ''} ${step.enabled === false ? 'is-disabled' : ''} ${isRunning ? 'is-running' : ''}`}
                >
                  <Checkbox.Root
                    checked={step.enabled !== false}
                    onCheckedChange={(v) => updateSteps([{ id: step.id, enabled: !!v }])}
                    className="xa-checkbox"
                    disabled={busy && isRunning}
                  >
                    <Checkbox.Indicator className="xa-checkbox-indicator">✓</Checkbox.Indicator>
                  </Checkbox.Root>
                  <div className="xa-step-body">
                    <div className="xa-step-title">
                      <span className="xa-step-title-text">{step.title}</span>
                      {isRunning && <span className="xa-step-confirm-tag">đang chạy</span>}
                      {!isRunning && needsConfirm && (
                        <span className={`xa-step-confirm-tag ${highRisk ? 'is-critical' : ''}`}>
                          {step.risk === 'critical' ? 'critical' : 'xác nhận'}
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className={`xa-step-status is-${step.status || 'pending'}`}
                    title={step.status || 'pending'}
                  >
                    {STATUS_ICON[step.status || 'pending'] || '•'}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {confirmCount > 0 && (
        <p className="xa-playbook-foot-hint">
          Bước có tag xác nhận cần bấm <strong>Force</strong> hoặc bỏ confirm trên dashboard.
        </p>
      )}
    </section>
  );
}
