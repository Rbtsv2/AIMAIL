// src/renderer/src/design-system/ErrorBoundary.tsx
import { Component, type ReactNode } from 'react'

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: { componentStack?: string }) { console.error('Erreur de rendu', error, info.componentStack) }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="empty" style={{ height: '100vh', background: 'var(--bg)' }}>
        <div style={{ maxWidth: 560 }}>
          <h3>Un écran a planté</h3>
          <p style={{ marginBottom: 12 }}>{this.state.error.message}</p>
          <pre style={{ textAlign: 'left', fontSize: 11, color: 'var(--text-2)', maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap' }}>{this.state.error.stack}</pre>
          <button className="btn primary" style={{ marginTop: 12 }} onClick={() => this.setState({ error: null })}>Réessayer</button>
          <button className="btn quiet" style={{ marginTop: 12, marginLeft: 8 }} onClick={() => location.reload()}>Recharger l’application</button>
        </div>
      </div>
    )
  }
}