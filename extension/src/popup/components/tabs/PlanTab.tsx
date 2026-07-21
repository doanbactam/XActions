// Agent / Strategist tab — analyze → playbook → run. TS/React counterpart
// of popup/agent-ui.js.
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

  return (
    <section className="xa-tab-content xa-plan">
      <div className="xa-plan-status-strip">
        <div className="xa-plan-status-main">
          <span className="xa-plan-status-label">Strategist</span>
          <span className="xa-plan-status-line">{agent.statusLine}</span>
        </div>
        <div className="xa-plan-status-actions">
          <button type="button" className="xa-btn-quiet" title="Grok & persona" onClick={() => setConfigOpen((v) => !v)}>
            Grok
          </button>
          <button type="button" className="xa-btn-quiet" title="Xóa chat" onClick={agent.clearHistory}>
            Clear
          </button>
        </div>
      </div>

      <PipelineSteps stage={agent.stage} />

      <Collapsible.Root open={configOpen} onOpenChange={setConfigOpen}>
        <Collapsible.Panel>
          <ConfigPanel agent={agent} />
        </Collapsible.Panel>
      </Collapsible.Root>

      {!agent.playbook && (
        <section className="xa-analyze-hero">
          <div className="xa-analyze-copy">
            <h2 className="xa-h2">Phân tích &amp; lên kịch bản</h2>
            <p className="xa-lead">
              Grok đọc profile, feed, phong cách và nhóm đối tượng trên tab x.com — rồi lập bước chạy an toàn.
            </p>
          </div>
          <button type="button" className="xa-btn-primary xa-btn-block xa-cta" disabled={agent.busy} onClick={agent.runStrategy}>
            Bắt đầu phân tích
          </button>
          <p className="xa-hint">Chạy nền · đóng popup vẫn xong · có thông báo</p>
          {agent.strategyError && <div className="xa-error-line">{agent.strategyError}</div>}
        </section>
      )}

      {agent.playbook && <PlaybookCard agent={agent} />}

      <ChatDrawer agent={agent} />
    </section>
  );
}
