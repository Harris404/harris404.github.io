import { memo } from 'react';

const AGENTS = {
  life:       { emoji: '🐦', name: 'Kookie', label: '生活', color: '#7ba4e8' },
  finance:    { emoji: '🦆', name: 'Platty', label: '财务', color: '#5a82c4' },
  education:  { emoji: '🐨', name: 'Koko',   label: '教育', color: '#b898d8' },
  healthcare: { emoji: '🦎', name: 'Spike',  label: '医疗', color: '#7fd4a0' },
  wellness:   { emoji: '🐹', name: 'Quokka', label: '休闲', color: '#f0a060' },
};

function AgentBadge({ agent }) {
  if (!agent) return null;
  const info = AGENTS[agent] || { emoji: '🤖', name: '', label: agent, color: '#8a8070' };

  return (
    <span
      className="agent-badge"
      style={{ borderColor: info.color, color: info.color, background: `${info.color}15` }}
    >
      {info.emoji} {info.name && `${info.name} · `}{info.label}
    </span>
  );
}

export default memo(AgentBadge);
