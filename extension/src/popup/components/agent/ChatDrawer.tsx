// by nichxbt
import * as React from 'react';
import { Collapsible } from '@base-ui/react/collapsible';
import type { UseAgentReturn } from '../../lib/useAgent';

const SUGGESTIONS = [
  { label: 'Phân tích lại', action: 'strategy' },
  { label: 'Hỏi kịch bản', prompt: 'Tóm tắt kịch bản và đề xuất risk conservative.' },
  { label: 'Stop all', prompt: 'Dừng tất cả automation (x_stop_all).' },
];

export function ChatDrawer({ agent }: { agent: UseAgentReturn }) {
  const { history, busy, sendChat, runStrategy } = agent;
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState('');

  const submit = (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || busy) return;
    sendChat(msg);
    setInput('');
  };

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} className="xa-chat-drawer">
      <Collapsible.Trigger className="xa-chat-drawer-trigger">
        <span>Chat phụ</span>
        <span className="xa-chat-drawer-sub">Chỉnh kịch bản · hỏi thêm</span>
      </Collapsible.Trigger>
      <Collapsible.Panel className="xa-chat-drawer-body">
        <div className="xa-chat">
          {history.length === 0 ? (
            <div className="xa-chat-empty">
              <p>Dùng chat sau khi đã có kịch bản — hoặc lệnh nhanh bên dưới.</p>
              <div className="xa-chat-suggestions">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    className="xa-chip"
                    onClick={() => (s.action === 'strategy' ? runStrategy() : submit(s.prompt))}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
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
