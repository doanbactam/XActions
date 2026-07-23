// Agent / Strategist tab — guided flow: login → analyze → run.
// by nichxbt

import * as React from 'react';
import { Collapsible } from '@base-ui/react/collapsible';
import { useAgent } from '../../lib/useAgent';
import { PipelineSteps } from '../agent/PipelineSteps';
import { ConfigPanel } from '../agent/ConfigPanel';
import { PlaybookCard } from '../agent/PlaybookCard';
import { ChatDrawer } from '../agent/ChatDrawer';

export function PlanTab() {
  const agent = useAgent();
  const [configOpen, setConfigOpen] = React.useState(false);

  const needsLogin = !agent.oauth.signedIn && !agent.oauthDevice;
  const hasPlaybook = !!agent.playbook;
  // Only show pipeline while analyzing / mid-flow — hide once playbook is ready
  const showPipeline = agent.busy || (agent.stage === 'analyze' && !hasPlaybook);

  return (
    <section className="xa-tab-content xa-plan">
      <div className="xa-plan-toolbar">
        <div className="xa-plan-toolbar-text">
          {agent.busy ? (
            <span className="xa-plan-busy">{agent.statusLine || 'Đang xử lý…'}</span>
          ) : hasPlaybook ? (
            <span className="xa-plan-ready">
              @{agent.playbook?.account?.handle || '…'} · sẵn sàng chạy
            </span>
          ) : agent.oauth.signedIn ? (
            <span className="xa-plan-ready">Grok sẵn sàng · phân tích tài khoản</span>
          ) : (
            <span className="xa-plan-muted">Cần đăng nhập Grok</span>
          )}
        </div>
        <button
          type="button"
          className={`xa-icon-btn xa-icon-btn-sm ${configOpen ? 'is-active' : ''}`}
          title="Cấu hình Grok"
          aria-label="Cấu hình Grok"
          aria-expanded={configOpen}
          onClick={() => setConfigOpen((v) => !v)}
        >
          ⚙
        </button>
      </div>

      {agent.busy && (
        <div className="xa-busy-track" aria-hidden="true">
          <div className="xa-busy-bar" />
        </div>
      )}

      <Collapsible.Root open={configOpen} onOpenChange={setConfigOpen}>
        <Collapsible.Panel className="xa-plan-config-panel">
          <ConfigPanel agent={agent} />
        </Collapsible.Panel>
      </Collapsible.Root>

      {showPipeline && <PipelineSteps stage={agent.stage} />}

      {needsLogin && !hasPlaybook && (
        <section className="xa-guide">
          <h2 className="xa-h2">Đăng nhập Grok</h2>
          <p className="xa-lead">Kết nối xAI để AI phân tích và lập kịch bản an toàn.</p>
          <button type="button" className="xa-btn-primary xa-btn-block xa-cta" onClick={agent.startOauth}>
            Đăng nhập xAI
          </button>
          {agent.testResult && !agent.testResult.ok && (
            <div className="xa-error-line">{agent.testResult.message}</div>
          )}
        </section>
      )}

      {!needsLogin && !hasPlaybook && (
        <section className="xa-guide">
          <h2 className="xa-h2">Phân tích tài khoản</h2>
          <p className="xa-lead">
            Đọc profile + feed trên tab x.com, rồi tạo kịch bản có kiểm soát safety.
          </p>
          <button
            type="button"
            className="xa-btn-primary xa-btn-block xa-cta"
            disabled={agent.busy || !agent.oauth.signedIn}
            onClick={agent.runStrategy}
          >
            {agent.busy ? 'Đang phân tích…' : 'Bắt đầu phân tích'}
          </button>
          <p className="xa-hint">
            {agent.backgroundMode
              ? 'Chạy nền — đóng popup vẫn xong.'
              : 'Bật Background Mode trong Cài đặt để chạy nền.'}
          </p>
          {agent.strategyError && <div className="xa-error-line">{agent.strategyError}</div>}
        </section>
      )}

      {hasPlaybook && <PlaybookCard agent={agent} />}

      {(hasPlaybook || agent.history.length > 0) && <ChatDrawer agent={agent} />}
    </section>
  );
}
