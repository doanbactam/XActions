// by nichxbt
import * as React from 'react';
import { Collapsible } from '@base-ui/react/collapsible';
import type { UseAgentReturn } from '../../lib/useAgent';

export function ChatDrawer({ agent }: { agent: UseAgentReturn }) {
  const { history, busy, sendChat } = agent;
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState('');

  const submit = (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || busy) return;
    sendChat(msg);
    setInput('');
  };

  const unreadHint = !open && history.length > 0 ? history.length : 0;

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} className="xa-chat-drawer">
      <Collapsible.Trigger className="xa-chat-drawer-trigger">
        <span>Chat</span>
        {unreadHint > 0 && <span className="xa-chat-count">{unreadHint}</span>}
        <span className="xa-chat-drawer-sub">{open ? 'Thu gọn' : 'Hỏi thêm · chỉnh kịch bản'}</span>
      </Collapsible.Trigger>
      <Collapsible.Panel className="xa-chat-drawer-body">
        <div className="xa-chat">
          {history.length === 0 ? (
            <div className="xa-chat-empty">
              <p>Hỏi Grok sau khi có kịch bản. Ví dụ: “giảm risk” hoặc “tóm tắt bước”.</p>
            </div>
          ) : (
            history.map((m, i) => (
              <div key={i} className={`xa-chat-msg xa-chat-msg-${m.role}`}>
                {m.content}
              </div>
            ))
          )}
        </div>
        <div className="xa-composer">
          <textarea
            className="xa-composer-input"
            rows={2}
            placeholder="Nhắn Grok… Enter gửi"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <button type="button" className="xa-btn-send" title="Gửi" aria-label="Gửi" onClick={() => submit()}>
            ↑
          </button>
        </div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
