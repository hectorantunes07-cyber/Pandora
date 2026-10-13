import { useState } from 'react';
import { Monitor } from 'lucide-react';
import { captureBenchmarkContext, contextRows, type BenchmarkContext } from '../shared/benchmark-context';
import { api, errorMessage, isDesktop } from './api';
import { Notice } from './components';

export function BenchmarkConfiguration({ phase, context, onCapture }: { phase: 'before' | 'after'; context?: BenchmarkContext; onCapture: (context: BenchmarkContext) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const capture = async () => {
    setBusy(true); setError('');
    try {
      const [info, tweaks] = await Promise.all([api.getSystem(true), api.getTweaks()]);
      onCapture(captureBenchmarkContext(info, tweaks));
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  };
  return <div className="capture-import">
    <button type="button" className="button secondary" disabled={!isDesktop || busy} onClick={() => void capture()}><Monitor size={16}/>{busy ? 'Reading PC configuration…' : `Capture ${phase} PC configuration`}</button>
    {!isDesktop && <small className="muted">PC snapshots are available in the desktop app.</small>}
    {error && <Notice tone="error">{error}</Notice>}
    {context && <details className="capture-help"><summary>{phase === 'before' ? 'Before' : 'After'} PC snapshot · {new Date(context.capturedAt).toLocaleString()}</summary><dl className="detail-list">{contextRows(context).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl><p>Read now, independently of the frame capture. Take this snapshot near your test run. Missing readings remain unavailable. Save measurements to retain it.</p></details>}
  </div>;
}
