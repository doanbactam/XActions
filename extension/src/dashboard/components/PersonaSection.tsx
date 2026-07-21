// Persona section — templates, test prompt, output preview.
// by nichxbt
import * as React from 'react';
import type { UseAgentReturn } from '../../popup/lib/useAgent';
import type { AgentPersonaConfig } from '../../popup/types';
import { parseListInput } from '../../popup/lib/format';

interface Template {
  id: string;
  name: string;
  desc: string;
  persona: AgentPersonaConfig;
}

const TEMPLATES: Template[] = [
  {
    id: 'growth',
    name: 'Growth Hacker',
    desc: 'Tăng trưởng nhanh, thử nghiệm liên tục',
    persona: { name: 'Growth Hacker', tone: 'năng động, data-driven', niche: 'SaaS / Startup', expertise: ['growth', 'experimentation', 'funnel'], avoid: ['spam', 'bait'], opinions: ['data beats opinions', 'ship fast'] },
  },
  {
    id: 'thought-leader',
    name: 'Thought Leader',
    desc: 'Chuyên gia, xây dựng authority',
    persona: { name: 'Thought Leader', tone: 'chuyên gia, rõ ràng', niche: 'AI / Tech', expertise: ['AI', 'product', 'strategy'], avoid: ['hype', 'fud'], opinions: ['long-term wins', 'depth over breadth'] },
  },
  {
    id: 'creator',
    name: 'Content Creator',
    desc: 'Sáng tạo, storytelling',
    persona: { name: 'Creator', tone: 'thân thiện, kể chuyện', niche: 'Creative / Media', expertise: ['storytelling', 'visual', 'trends'], avoid: ['dry', 'corporate'], opinions: ['authenticity wins', 'consistency compounds'] },
  },
  {
    id: 'analyst',
    name: 'Analyst',
    desc: 'Phân tích, insight, data',
    persona: { name: 'Analyst', tone: 'khách quan, chính xác', niche: 'Finance / Data', expertise: ['analytics', 'research', 'charts'], avoid: ['speculation', 'hype'], opinions: ['numbers don\'t lie', 'skeptical by default'] },
  },
];

function buildPreview(p: AgentPersonaConfig): string {
  const lines: string[] = [];
  lines.push(`# Persona: ${p.name || 'XActions'}`);
  if (p.niche) lines.push(`Niche: ${p.niche}`);
  if (p.tone) lines.push(`Tone: ${p.tone}`);
  if (p.expertise) {
    const ex = Array.isArray(p.expertise) ? p.expertise.join(', ') : p.expertise;
    if (ex) lines.push(`Expertise: ${ex}`);
  }
  if (p.opinions) {
    const op = Array.isArray(p.opinions) ? p.opinions.join('; ') : p.opinions;
    if (op) lines.push(`Opinions: ${op}`);
  }
  if (p.avoid) {
    const av = Array.isArray(p.avoid) ? p.avoid.join(', ') : p.avoid;
    if (av) lines.push(`Avoid: ${av}`);
  }
  return lines.join('\n');
}

export function PersonaSection({ agent }: { agent: UseAgentReturn }) {
  const { persona, saveConfig } = agent;
  const [draft, setDraft] = React.useState<AgentPersonaConfig>(persona);
  const [activeTemplate, setActiveTemplate] = React.useState<string | null>(null);
  const [testPrompt, setTestPrompt] = React.useState('Viết 1 tweet giới thiệu bản thân.');
  const [testOutput, setTestOutput] = React.useState<string | null>(null);
  const [testing, setTesting] = React.useState(false);

  React.useEffect(() => setDraft(persona), [persona]);

  const applyTemplate = (t: Template) => {
    setDraft(t.persona);
    setActiveTemplate(t.id);
  };

  const save = () => {
    saveConfig({ persona: draft });
  };

  const runTest = async () => {
    setTesting(true);
    setTestOutput(null);
    try {
      // Use AGENT_CHAT to test persona with a simple prompt
      const res = await chrome.runtime.sendMessage({
        type: 'AGENT_CHAT',
        userMessage: `[Persona test] ${testPrompt}`,
      });
      if (res?.ok) {
        setTestOutput(res.content || '(không có output)');
      } else {
        setTestOutput(`❌ ${res?.error || 'Test thất bại — cần đăng nhập Grok'}`);
      }
    } catch (e) {
      setTestOutput(`❌ ${(e as Error).message}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div>
      {/* Templates */}
      <div className="xa-dash-card">
        <div className="xa-dash-card-title">Templates</div>
        <p className="xa-dash-field-hint" style={{ marginBottom: 12 }}>Chọn template để bắt đầu nhanh, rồi tinh chỉnh bên dưới.</p>
        {TEMPLATES.map((t) => (
          <div
            key={t.id}
            className={`xa-dash-persona-template ${activeTemplate === t.id ? 'is-active' : ''}`}
            onClick={() => applyTemplate(t)}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 650 }}>{t.name}</div>
              <div style={{ fontSize: 11, color: 'var(--xa-ink-3)' }}>{t.desc}</div>
            </div>
            {activeTemplate === t.id && <span style={{ color: 'var(--xa-accent-2)' }}>✓</span>}
          </div>
        ))}
      </div>

      {/* Editor */}
      <div className="xa-dash-card">
        <div className="xa-dash-card-title">Chỉnh sửa persona</div>

        <div className="xa-dash-grid-2">
          <label className="xa-dash-field">
            <span className="xa-dash-field-label">Tên</span>
            <input className="xa-dash-input" value={draft.name || ''} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} />
          </label>
          <label className="xa-dash-field">
            <span className="xa-dash-field-label">Niche</span>
            <input className="xa-dash-input" value={draft.niche || ''} onChange={(e) => setDraft((p) => ({ ...p, niche: e.target.value }))} />
          </label>
        </div>

        <label className="xa-dash-field">
          <span className="xa-dash-field-label">Tone</span>
          <input className="xa-dash-input" value={draft.tone || ''} onChange={(e) => setDraft((p) => ({ ...p, tone: e.target.value }))} />
        </label>

        <label className="xa-dash-field">
          <span className="xa-dash-field-label">Expertise</span>
          <span className="xa-dash-field-hint">Phân tách bằng dấu phẩy</span>
          <input
            className="xa-dash-input"
            defaultValue={Array.isArray(draft.expertise) ? draft.expertise.join(', ') : draft.expertise || ''}
            onBlur={(e) => setDraft((p) => ({ ...p, expertise: parseListInput(e.target.value) }))}
          />
        </label>

        <label className="xa-dash-field">
          <span className="xa-dash-field-label">Opinions</span>
          <span className="xa-dash-field-hint">Quan điểm rõ ràng — phân tách bằng dấu phẩy</span>
          <input
            className="xa-dash-input"
            defaultValue={Array.isArray(draft.opinions) ? draft.opinions.join(', ') : draft.opinions || ''}
            onBlur={(e) => setDraft((p) => ({ ...p, opinions: parseListInput(e.target.value) }))}
          />
        </label>

        <label className="xa-dash-field">
          <span className="xa-dash-field-label">Avoid</span>
          <input
            className="xa-dash-input"
            defaultValue={Array.isArray(draft.avoid) ? draft.avoid.join(', ') : draft.avoid || ''}
            onBlur={(e) => setDraft((p) => ({ ...p, avoid: parseListInput(e.target.value) }))}
          />
        </label>

        <button type="button" className="xa-dash-btn xa-dash-btn-primary" onClick={save}>
          Lưu persona
        </button>
      </div>

      {/* Preview */}
      <div className="xa-dash-card">
        <div className="xa-dash-card-title">Preview</div>
        <pre className="xa-dash-persona-preview">{buildPreview(draft)}</pre>
      </div>

      {/* Test prompt */}
      <div className="xa-dash-card">
        <div className="xa-dash-card-title">Test prompt</div>
        <p className="xa-dash-field-hint" style={{ marginBottom: 12 }}>
          Gửi 1 prompt đến Grok để xem persona hoạt động thế nào. Cần đăng nhập xAI.
        </p>
        <label className="xa-dash-field">
          <span className="xa-dash-field-label">Prompt</span>
          <textarea className="xa-dash-input" rows={3} value={testPrompt} onChange={(e) => setTestPrompt(e.target.value)} />
        </label>
        <button type="button" className="xa-dash-btn xa-dash-btn-primary" disabled={testing || !agent.oauth.signedIn} onClick={runTest}>
          {testing ? 'Đang test…' : 'Chạy test'}
        </button>
        {!agent.oauth.signedIn && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--xa-ink-3)' }}>⚠ Cần đăng nhập xAI để test.</div>
        )}
        {testOutput && (
          <div style={{ marginTop: 14 }}>
            <div className="xa-dash-field-label" style={{ marginBottom: 6 }}>Output</div>
            <pre className="xa-dash-persona-preview">{testOutput}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
