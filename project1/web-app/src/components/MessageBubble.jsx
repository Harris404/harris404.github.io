import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function MessageBubble({ role, content }) {
  return (
    <div className={`msg ${role}`}>
      <div className="msg-label">{role === 'user' ? '你' : '澳知AI'}</div>
      <div className="msg-bubble">
        {role === 'assistant' ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        ) : (
          content
        )}
      </div>
    </div>
  );
}

export default memo(MessageBubble);
