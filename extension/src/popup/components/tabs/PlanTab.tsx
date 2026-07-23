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
  const showPipeline = agent.stage !== 'setup' || agent.busy;

  return (
    <section className="xa-tab-content xa-plan">
      {showPipeline && <PipelineSteps stage={agent.stage} />}

      <div className="xa-plan-status-strip">
        <div className="xa-plan-status-main">
          <span className="xa-plan-status-label">Strategist</span>
          <span className="xa-plan-status-line">{agent.statusLine}</span>
        </div>
        <div className="xa-plan-status-actions">
          <button type="button" className="xa-btn-quiet" title="Grok & persona" onClick={() => setConfigOpen((v) => !v)}>
            ⚙
          </button>
        </div>
      </div>

      <Collapsible.Root open={configOpen} onOpenChange={setConfigOpen}>
        <Collapsible.Panel>
          <ConfigPanel agent={agent} />
        </Collapsible.Panel>
      </Collapsible.Root>

      {/* Guided flow — chỉ hiện 1 section theo state */}
      {needsLogin && !hasPlaybook && (
        <section className="xa-guide">
          <div className="xa-guide-step">
            <span className="xa-guide-num">1</span>
            <div className="xa-guide-body">
              <h2 className="xa-h2">Đăng nhập Grok</h2>
              <p className="xa-lead">Kết nối xAI (SuperGrok / Premium+) để AI phân tích tài khoản và lên kịch bản.</p>
            </div>
          </div>
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
          <div className="xa-guide-step">
            <span className="xa-guide-num">✓</span>
            <div className="xa-guide-body">
              <h2 className="xa-h2">Grok đã sẵn sàng</h2>
              <p className="xa-lead">
                {agent.oauth.signedIn
                  ? 'AI sẽ đọc profile, feed, phong cách trên tab x.com — rồi lập kịch bản chạy an toàn.'
                  : 'Hoàn tất đăng nhập để bắt đầu phân tích.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="xa-btn-primary xa-btn-block xa-cta"
            disabled={agent.busy || !agent.oauth.signedIn}
            onClick={agent.runStrategy}
          >
            {agent.busy ? 'Đang phân tích…' : 'Phân tích tài khoản'}
          </button>
          <p className="xa-hint">
            {agent.backgroundMode
              ? 'Chạy nền · HTTP API trước · đóng popup vẫn xong · có thông báo'
              : 'Cần để popup mở hoặc bật Background Mode trong Settings để chạy nền qua HTTP API.'}
          </p>
          {agent.strategyError && <div className="xa-error-line">{agent.strategyError}</div>}
        </section>
      )}

      {hasPlaybook && <PlaybookCard agent={agent} />}

      {/* Chỉ hiện chat drawer khi đã có playbook hoặc đã có history */}
      {(hasPlaybook || agent.history.length > 0) && <ChatDrawer agent={agent} />}
    </section>
  );
}
