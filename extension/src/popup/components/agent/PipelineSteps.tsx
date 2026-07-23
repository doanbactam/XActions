// by nichxbt
import type { AgentStage } from '../../types';

const STAGES: { id: AgentStage; label: string }[] = [
  { id: 'setup', label: 'Grok' },
  { id: 'analyze', label: 'Phân tích' },
  { id: 'playbook', label: 'Kịch bản' },
  { id: 'run', label: 'Chạy' },
];

export function PipelineSteps({ stage }: { stage: AgentStage }) {
  const currentIndex = Math.max(
    0,
    STAGES.findIndex((s) => s.id === stage),
  );
  return (
    <ol className="xa-pipeline" aria-label="Tiến trình">
      {STAGES.map((s, i) => (
        <li
          key={s.id}
          className={`xa-pipe ${i === currentIndex ? 'is-active' : ''} ${i < currentIndex ? 'is-done' : ''}`}
        >
          <span className="xa-pipe-dot" aria-hidden="true" />
          <span className="xa-pipe-label">{s.label}</span>
        </li>
      ))}
    </ol>
  );
}
