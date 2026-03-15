import { useState } from 'react';
import { useConversations } from '../hooks/useConversations';
import { useGeolocation } from '../hooks/useGeolocation';
import ConversationSidebar from './ConversationSidebar';
import ChatPanel from './ChatPanel';

export default function ChatPage({ onBack }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useGeolocation();
  const {
    conversations,
    activeId,
    activeConv,
    createConversation,
    switchConversation,
    deleteConversation,
    addMessage,
    getContext,
  } = useConversations();

  return (
    <div className={`chat-page ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      {/* Top bar */}
      <div className="chat-page-header">
        <div className="header-left">
          {!sidebarOpen && (
            <button
              className="sidebar-toggle-btn"
              onClick={() => setSidebarOpen(true)}
              title="展开侧边栏"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M9 3v18"/>
                <path d="M14 9l3 3-3 3"/>
              </svg>
            </button>
          )}
          <button
            className="sidebar-toggle-btn mobile-only"
            onClick={() => setSidebarOpen(v => !v)}
            title="菜单"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <div className="chat-page-brand">🦘 澳知AI</div>
        </div>
        <button className="back-btn" onClick={onBack} title="返回首页">
          ← 首页
        </button>
      </div>

      {/* Chat container */}
      <div className="chat-page-body">
        <ConversationSidebar
          conversations={conversations}
          activeId={activeId}
          onCreate={createConversation}
          onSwitch={switchConversation}
          onDelete={deleteConversation}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(v => !v)}
        />
        <ChatPanel
          activeConv={activeConv}
          activeId={activeId}
          addMessage={addMessage}
          getContext={getContext}
          location={location}
        />
      </div>
    </div>
  );
}
