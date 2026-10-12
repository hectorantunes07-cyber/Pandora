import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div className="fatal-error"><img src="./logo.svg" width="56" alt="PANDORA"/><h1>Let’s get you back on track.</h1><p>The interface encountered an error. Reload PANDORA to reconnect and review your saved history.</p><button className="button primary" onClick={() => window.location.reload()}>Reload PANDORA</button></div>;
    return this.props.children;
  }
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><ErrorBoundary><App/></ErrorBoundary></React.StrictMode>);
