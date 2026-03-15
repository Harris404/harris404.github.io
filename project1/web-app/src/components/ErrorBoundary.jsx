import { Component } from 'react';

/**
 * React Error Boundary — catches render errors and shows a fallback UI
 * instead of a blank white screen.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100vh', padding: '2rem',
          background: 'var(--bg-primary, #0a0a0f)', color: 'var(--text-primary, #e0e0e0)',
          fontFamily: "'Inter', sans-serif", textAlign: 'center',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🦘</div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: 'var(--accent-primary, #6366f1)' }}>
            哎呀，出了点问题
          </h2>
          <p style={{ opacity: 0.7, marginBottom: '1.5rem', maxWidth: '400px' }}>
            应用遇到了意外错误。请尝试刷新页面。
          </p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={this.handleRetry}
              style={{
                padding: '0.75rem 1.5rem', borderRadius: '12px', border: 'none',
                background: 'var(--accent-primary, #6366f1)', color: '#fff',
                fontSize: '1rem', cursor: 'pointer', fontWeight: '600',
              }}
            >
              重试
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '0.75rem 1.5rem', borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.15)', background: 'transparent',
                color: 'var(--text-primary, #e0e0e0)', fontSize: '1rem', cursor: 'pointer',
              }}
            >
              刷新页面
            </button>
          </div>
          {this.state.error && (
            <details style={{ marginTop: '2rem', opacity: 0.4, fontSize: '0.75rem', maxWidth: '500px' }}>
              <summary>错误详情</summary>
              <pre style={{ whiteSpace: 'pre-wrap', textAlign: 'left' }}>
                {this.state.error.toString()}
              </pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
