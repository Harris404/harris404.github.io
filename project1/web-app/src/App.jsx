import { useState } from 'react';
import LandingPage from './components/LandingPage';
import ChatPage from './components/ChatPage';

export default function App() {
  const [page, setPage] = useState('landing');

  if (page === 'chat') {
    return <ChatPage onBack={() => setPage('landing')} />;
  }

  return <LandingPage onStartChat={() => setPage('chat')} />;
}
