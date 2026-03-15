import { useState } from 'react';
import LandingPage from './components/LandingPage';
import ChatPage from './components/ChatPage';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  const [page, setPage] = useState('landing');

  return (
    <ErrorBoundary>
      {page === 'chat'
        ? <ChatPage onBack={() => setPage('landing')} />
        : <LandingPage onStartChat={() => setPage('chat')} />
      }
    </ErrorBoundary>
  );
}
