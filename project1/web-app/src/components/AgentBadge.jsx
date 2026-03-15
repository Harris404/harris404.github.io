import { memo } from 'react';

const AGENTS = {
  life:       { emoji: '🏠', label: '生活' },
  finance:    { emoji: '💰', label: '财务' },
  education:  { emoji: '🎓', label: '教育' },
  healthcare: { emoji: '🏥', label: '医疗' },
  wellness:   { emoji: '🌿', label: '休闲' },
};

function AgentBadge({ agent }) {
  if (!agent) return null;
  const info = AGENTS[agent] || { emoji: '🤖', label: agent };

  return (
    <span className="agent-badge">
      {info.emoji} {info.label}
    </span>
  );
}

export default memo(AgentBadge);
