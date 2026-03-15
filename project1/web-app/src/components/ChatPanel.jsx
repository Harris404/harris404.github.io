import { useState, useRef, useEffect, useCallback } from 'react';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';
import StreamingStatus from './StreamingStatus';
import AgentBadge from './AgentBadge';
import { streamChat } from '../services/api';
import { QUICK_ASKS } from '../config';

export default function ChatPanel({ activeConv, activeId, addMessage, getContext, location }) {
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [pendingImage, setPendingImage] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [activeTools, setActiveTools] = useState([]);
  const [currentAgent, setCurrentAgent] = useState('');
  const [responseMeta, setResponseMeta] = useState(null);

  const messagesRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const abortRef = useRef(null);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => { scrollToBottom(); }, [activeConv?.messages, streamingText, scrollToBottom]);

  // Auto-resize textarea
  const handleInputChange = (e) => {
    setInputText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  // Image upload
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert('图片不能超过10MB'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setPendingImage(ev.target.result);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setPendingImage(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  // Stop generating
  const stopGenerating = () => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setStatusMsg('');
    setActiveTools([]);
  };

  // Send message
  const sendMessage = useCallback(async (text) => {
    const msg = text || inputText.trim();
    if (!msg || isStreaming) return;

    addMessage('user', msg);
    setInputText('');
    if (inputRef.current) inputRef.current.style.height = 'auto';

    const imageToSend = pendingImage;
    removeImage();
    setIsStreaming(true);
    setStreamingText('');
    setStatusMsg('正在分析问题...');
    setActiveTools([]);
    setCurrentAgent('');
    setResponseMeta(null);

    const context = getContext();
    const controller = new AbortController();
    abortRef.current = controller;

    const fullText = await streamChat({
      message: msg,
      sessionId: activeId,
      history: context,
      imageBase64: imageToSend,
      location,
      signal: controller.signal,
      onChunk: (t) => { setStreamingText(t); setStatusMsg(''); },
      onStatus: (s) => setStatusMsg(s),
      onToolStart: (tool) => setActiveTools(prev => [...prev, tool]),
      onToolDone: (tool) => setActiveTools(prev => prev.filter(t => t !== tool)),
      onMeta: (meta) => { setCurrentAgent(meta.agent); setResponseMeta(meta); },
      onError: (err) => setStreamingText(err),
    });

    setStreamingText('');
    setStatusMsg('');
    setActiveTools([]);
    if (fullText) addMessage('assistant', fullText);
    setIsStreaming(false);
    inputRef.current?.focus();
  }, [inputText, isStreaming, pendingImage, activeId, addMessage, getContext]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="chat-main">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-left">
          <div className="chat-status" />
          <div>
            <h3>澳知AI 助手</h3>
            <div className="model">Powered by Qwen · 52 tools · RAG</div>
          </div>
        </div>
        <div className="chat-header-right">
          <AgentBadge agent={currentAgent} />
          {responseMeta && (
            <span className="response-time">{(responseMeta.elapsedMs / 1000).toFixed(1)}s</span>
          )}
        </div>
      </div>

      {/* Quick Asks */}
      <div className="quick-asks">
        {QUICK_ASKS.map((q, i) => (
          <div key={i} className="quick-ask" onClick={() => sendMessage(q.text)}>
            {q.emoji} {q.label}
          </div>
        ))}
      </div>

      {/* Messages */}
      <div className="chat-messages" ref={messagesRef}>
        {activeConv?.messages.map((msg, i) => (
          <MessageBubble key={i} role={msg.role} content={msg.content} />
        ))}
        {isStreaming && streamingText && (
          <MessageBubble role="assistant" content={streamingText} />
        )}
        {isStreaming && !streamingText && <TypingIndicator />}
        <StreamingStatus
          status={statusMsg}
          activeTools={activeTools}
          hasContent={!!streamingText}
        />
      </div>

      {/* Image Preview */}
      <div className={`img-preview ${pendingImage ? 'active' : ''}`}>
        {pendingImage && (
          <>
            <img src={pendingImage} alt="preview" />
            <button className="remove-img" onClick={removeImage}>✕ 移除图片</button>
          </>
        )}
      </div>

      {/* Input */}
      <div className="chat-input-area">
        <button
          className={`img-btn ${pendingImage ? 'has-image' : ''}`}
          onClick={() => fileRef.current?.click()}
          title="上传图片"
        >
          📷
        </button>
        <input
          type="file"
          ref={fileRef}
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          onChange={handleImageUpload}
        />
        <textarea
          className="chat-input"
          ref={inputRef}
          placeholder="输入你的问题... (例如: 墨尔本三日游攻略)"
          rows={1}
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
        />
        {isStreaming ? (
          <button className="stop-btn" onClick={stopGenerating} title="停止生成">
            ⏹
          </button>
        ) : (
          <button
            className="send-btn"
            onClick={() => sendMessage()}
            disabled={!inputText.trim()}
          >
            ➤
          </button>
        )}
      </div>
    </div>
  );
}
