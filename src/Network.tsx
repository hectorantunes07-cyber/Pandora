import { useState } from 'react';
import { Activity, Globe, Radio, ShieldCheck, Wifi } from 'lucide-react';
import type { NetworkResult, NetworkTarget } from '../shared/types';
import { api, errorMessage, isDesktop } from './api';
import { Badge, Notice, PageHeading, PanelTitle, Spinner } from './components';
import { NetworkInspection } from './NetworkInspection';
const ms = (value: number | null) => value === null ? 'Unavailable' : `${value.toFixed(1)} ms`;
export function NetworkDiagnostics() {
  const [target, setTarget] = useState<NetworkTarget>('cloudflare');
  const [result, setResult] = useState<NetworkResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async () => {
    if (busy) return;
    setBusy(true); setError(''); setResult(null);
    try { setResult(await api.testNetwork(target)); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  };
  return <>
    <PageHeading eyebrow="CONNECTION TESTS" title="Network Diagnostics" description="Check network adapters, DNS resolution, and connection latency."/>
    <NetworkInspection/>
    <section className="panel network-test">
      <PanelTitle icon={Wifi} title="Connection check" action={<Badge tone="purple">READ ONLY</Badge>}/>
      <p>Send eight small ICMP requests to a public diagnostic destination. Tests run only when you choose Start test. No DNS, adapter or Windows settings are changed.</p>
      <div className="process-toolbar"><label className="network-destination">Diagnostic destination<select className="select" aria-label="Diagnostic destination" value={target} disabled={busy} onChange={event => setTarget(event.target.value as NetworkTarget)}><option value="cloudflare">Cloudflare · 1.1.1.1</option><option value="google">Google · 8.8.8.8</option></select></label>
        <button className="button primary" disabled={busy || !isDesktop} onClick={run}>{busy ? <Spinner label="Measuring connection…"/> : <><Radio size={17}/>Start test</>}</button>
      </div>
      {busy && <p className="accounting-note" role="status">Waiting for actual replies. Each request has a one-second timeout; this usually takes a few seconds.</p>}
      {!isDesktop && <Notice>Open the Windows desktop app to measure your connection.</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
    </section>
    {result && <section className="panel" aria-label="Network test results">
      <PanelTitle icon={Activity} title="Your measured results" action={<Badge tone={result.received === 8 ? 'green' : 'amber'}>{result.received} OF 8 REPLIES</Badge>}/>
      <div className="result-stats"><div><strong>{ms(result.averageMs)}</strong><span>Average round trip</span></div><div><strong>{ms(result.jitterMs)}</strong><span>Jitter between adjacent replies</span></div><div><strong>{result.lossPercent.toFixed(1)}%</strong><span>Requests without a reply</span></div></div>
      <div className="network-samples" aria-label="Individual ping samples">{result.samples.map((sample, index) => <div className={sample === null ? 'lost' : ''} key={index}><span>#{index + 1}</span><strong>{sample === null ? 'No reply' : ms(sample)}</strong></div>)}</div>
      <dl className="detail-list"><div><dt>Destination</dt><dd>{result.target === 'cloudflare' ? 'Cloudflare' : 'Google'} · {result.address}</dd></div><div><dt>Minimum / maximum</dt><dd>{ms(result.minMs)} / {ms(result.maxMs)}</dd></div><div><dt>Measured</dt><dd>{new Date(result.timestamp).toLocaleString()}</dd></div></dl>
      <Notice tone={result.received ? 'info' : 'warning'}>{result.received ? 'Jitter is the mean absolute difference between consecutive successful replies. Missing replies break the sequence. This short sample describes this destination at this moment.' : 'No replies were received. ICMP may be blocked or deprioritized by your network or the destination; this does not prove your internet connection is down.'}</Notice>
    </section>}
    <div className="two-columns"><section className="panel"><PanelTitle icon={Globe} title="What this tells you"/><p className="panel-empty">Compare repeat tests under similar conditions. Wi-Fi interference, downloads, routing and server distance can affect results. A public resolver is not your game server.</p></section><section className="panel"><PanelTitle icon={ShieldCheck} title="What stays in your control"/><p className="panel-empty">PANDORA never changes DNS or network adapter settings as a result of this test. Results stay in this session; there is no background network probing.</p></section></div>
  </>;
}
