import { useState, useCallback, useEffect, useRef } from 'react';
import { WELCOME_MESSAGE, MAX_CONTEXT } from '../config';

const STORAGE_KEY = 'aozhi-conversations';

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    // Cleanup: remove duplicate empty "新对话" (keep only the most recent one)
    let keptOneEmpty = false;
    const cleaned = data.filter(c => {
      if (c.title === '新对话' && c.messages.length <= 1) {
        if (keptOneEmpty) return false; // Remove duplicate empties
        keptOneEmpty = true;
      }
      return true;
    });
    if (cleaned.length !== data.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    }
    return cleaned;
  }
  catch { return []; }
}

function save(convs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(convs));
}

function makeNewConv() {
  return {
    id: crypto.randomUUID(),
    title: '新对话',
    messages: [WELCOME_MESSAGE],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function useConversations() {
  const [conversations, setConversations] = useState(() => load());
  const [activeId, setActiveId] = useState(null);
  const initialized = useRef(false);

  // On mount: activate newest conversation, or create one if none exist
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const existing = load();
    if (existing.length > 0) {
      // Just activate the newest conversation — don't create a new one
      setActiveId(existing[0].id);
    } else {
      // No history at all — create the first conversation
      const newConv = makeNewConv();
      setConversations([newConv]);
      setActiveId(newConv.id);
    }
  }, []);

  // Persist
  useEffect(() => { save(conversations); }, [conversations]);

  const activeConv = conversations.find(c => c.id === activeId) || null;

  const createConversation = useCallback(() => {
    // If there's already an empty "新对话", just switch to it instead of making another
    setConversations(prev => {
      const existingEmpty = prev.find(c => c.title === '新对话' && c.messages.length <= 1);
      if (existingEmpty) {
        setActiveId(existingEmpty.id);
        return prev; // No change needed
      }
      const conv = makeNewConv();
      setActiveId(conv.id);
      return [conv, ...prev];
    });
  }, []);

  const switchConversation = useCallback((id) => {
    setActiveId(id);
  }, []);

  // Delete — use functional updates to avoid stale closure
  const deleteConversation = useCallback((id) => {
    setActiveId(prevActiveId => {
      setConversations(prevConvs => {
        const next = prevConvs.filter(c => c.id !== id);
        if (next.length === 0) {
          // All deleted — create a fresh one
          const fresh = makeNewConv();
          // Need to set activeId to fresh.id after this
          setTimeout(() => setActiveId(fresh.id), 0);
          return [fresh];
        }
        // If we deleted the active one, switch
        if (id === prevActiveId) {
          setTimeout(() => setActiveId(next[0].id), 0);
        }
        return next;
      });
      return prevActiveId; // return current for now, setTimeout will update
    });
  }, []);

  const addMessage = useCallback((role, content) => {
    setConversations(prev => prev.map(c => {
      if (c.id !== activeId) return c;
      const updated = {
        ...c,
        messages: [...c.messages, { role, content }],
        updatedAt: Date.now(),
      };
      if (role === 'user' && c.title === '新对话') {
        updated.title = content.slice(0, 30) + (content.length > 30 ? '...' : '');
      }
      return updated;
    }));
  }, [activeId]);

  const getContext = useCallback(() => {
    if (!activeConv) return [];
    return activeConv.messages
      .filter(m => !(m.role === 'assistant' && m.content.startsWith('👋')))
      .slice(-MAX_CONTEXT)
      .map(m => ({ role: m.role, content: m.content }));
  }, [activeConv]);

  return {
    conversations,
    activeId,
    activeConv,
    createConversation,
    switchConversation,
    deleteConversation,
    addMessage,
    getContext,
  };
}
