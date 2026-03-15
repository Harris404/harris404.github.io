import { useState, useRef, useEffect } from 'react';

function formatTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return '昨天';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function ConversationSidebar({ conversations, activeId, onCreate, onSwitch, onDelete, isOpen, onToggle }) {
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const sidebarRef = useRef(null);

  // Close confirm on outside click
  useEffect(() => {
    const handle = (e) => {
      if (confirmDeleteId && sidebarRef.current && !sidebarRef.current.contains(e.target)) {
        setConfirmDeleteId(null);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [confirmDeleteId]);

  const handleDelete = (id, e) => {
    e.stopPropagation();
    if (confirmDeleteId === id) {
      onDelete(id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId(null), 3000);
    }
  };

  const handleNewChat = () => {
    onCreate();
    // Auto-close sidebar on mobile after creating
    if (window.innerWidth < 768) onToggle?.();
  };

  const handleSwitch = (id) => {
    onSwitch(id);
    if (window.innerWidth < 768) onToggle?.();
  };

  // Group conversations by date
  const today = [];
  const yesterday = [];
  const older = [];
  const now = new Date();
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(now.getDate() - 1);

  conversations.forEach(conv => {
    const d = new Date(conv.updatedAt);
    if (d.toDateString() === now.toDateString()) today.push(conv);
    else if (d.toDateString() === yesterdayDate.toDateString()) yesterday.push(conv);
    else older.push(conv);
  });

  const renderGroup = (label, items) => {
    if (items.length === 0) return null;
    return (
      <div className="conv-group" key={label}>
        <div className="conv-group-label">{label}</div>
        {items.map(conv => (
          <div
            key={conv.id}
            className={`conv-item ${conv.id === activeId ? 'active' : ''}`}
            onClick={() => handleSwitch(conv.id)}
          >
            <div className="conv-item-icon">💬</div>
            <div className="conv-item-content">
              <div className="conv-item-title">{conv.title || '新对话'}</div>
            </div>
            <button
              className={`del-btn ${confirmDeleteId === conv.id ? 'confirm' : ''}`}
              title={confirmDeleteId === conv.id ? '确认删除' : '删除'}
              onClick={(e) => handleDelete(conv.id, e)}
            >
              {confirmDeleteId === conv.id ? '✓' : '×'}
            </button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && <div className="sidebar-overlay" onClick={onToggle} />}

      <div ref={sidebarRef} className={`conv-sidebar ${isOpen ? 'open' : 'closed'}`}>
        {/* New Chat Button - full width at top */}
        <div className="sidebar-top">
          <button className="new-chat-btn" onClick={handleNewChat}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M14 2H6L2 6v8h12V2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M6 2v4H2" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M5.5 10h5M8 7.5v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span>新对话</span>
          </button>
          <button className="sidebar-close-btn" onClick={onToggle} title="收起侧边栏">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="M9 3v18"/>
              <path d="M14 9l-3 3 3 3"/>
            </svg>
          </button>
        </div>

        {/* Conversation list */}
        <div className="conv-list">
          {conversations.length === 0 ? (
            <div className="conv-empty">
              <div className="conv-empty-icon">🦘</div>
              <div>开始你的第一次对话</div>
            </div>
          ) : (
            <>
              {renderGroup('今天', today)}
              {renderGroup('昨天', yesterday)}
              {renderGroup('更早', older)}
            </>
          )}
        </div>

        {/* Bottom section */}
        <div className="sidebar-bottom">
          <div className="sidebar-brand">
            <span className="brand-icon">🦘</span>
            <span>澳知AI</span>
          </div>
        </div>
      </div>
    </>
  );
}

export default ConversationSidebar;
