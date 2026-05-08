import { Component, ErrorInfo, ReactNode } from 'react';

interface Props  { children: ReactNode; }
interface State  { error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State { return { error }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '2rem', background: 'var(--bg)', color: 'var(--text)',
        textAlign: 'center',
      }}>
        <p style={{ fontSize: 48, marginBottom: 8 }}>⚠️</p>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 8 }}>Something went wrong</h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.5rem', maxWidth: 360 }}>
          An unexpected error occurred. Please refresh the page.
        </p>
        <button
          className="btn-primary"
          onClick={() => { this.setState({ error: null }); window.location.reload(); }}
        >
          Refresh Page
        </button>
        {process.env.NODE_ENV === 'development' && (
          <pre style={{ marginTop: '1.5rem', fontSize: 11, color: 'var(--text-muted)', textAlign: 'left', maxWidth: 500, overflow: 'auto' }}>
            {this.state.error.message}
          </pre>
        )}
      </div>
    );
  }
}
