import { Activity, Route } from 'lucide-react';
import type { NetworkPathResult, NetworkResult } from '../shared/types';
import { Badge, Notice, PanelTitle } from './components';
const ms = (value: number | null) => value === null ? 'Unavailable' : `${value.toFixed(1)} ms`;
function Hop({ title, result }: { title: string; result: Omit<NetworkResult, 'target' | 'address'> | null }) {
  return <section className="panel" aria-label={title}>
    <PanelTitle icon={Activity} title={title} action={<Badge tone={result?.received === 8 ? 'green' : 'amber'}>{result ? `${result.received} OF 8 REPLIES` : 'UNAVAILABLE'}</Badge>}/>
    {!result && <p className="panel-empty">No usable gateway measurement was returned. See the route status below.</p>}
    {result && <><dl className="detail-list"><div><dt>Average round trip</dt><dd>{ms(result.averageMs)}</dd></div><div><dt>Requests without a reply</dt><dd>{result.lossPercent.toFixed(1)}%</dd></div><div><dt>Adjacent-reply jitter</dt><dd>{ms(result.jitterMs)}</dd></div><div><dt>Minimum / maximum</dt><dd>{ms(result.minMs)} / {ms(result.maxMs)}</dd></div></dl>
      <div className="network-samples" aria-label={`${title} samples`}>{result.samples.map((sample, index) => <div className={sample === null ? 'lost' : ''} key={index}><span>#{index + 1}</span><strong>{sample === null ? 'No reply' : ms(sample)}</strong></div>)}</div></>}
  </section>;
}
export function NetworkPathResults({ result }: { result: NetworkPathResult }) {
  return <section className="network-path-results" aria-label="Local and internet comparison">
    <PanelTitle icon={Route} title="Local and internet comparison"/>
    <p>Eight requests per destination, measured one after the other. Completed {new Date(result.timestamp).toLocaleString()}.</p>
    <div className="two-columns"><Hop title="Selected route gateway" result={result.gateway}/><Hop title={result.target === 'google' ? 'Google · 8.8.8.8' : 'Cloudflare · 1.1.1.1'} result={result.internet}/></div>
    {result.gatewayStatus === 'no-gateway' && <Notice>This route has no separate IPv4 gateway. This can happen with a direct or VPN connection. The internet measurements are still available.</Notice>}
    {result.gatewayStatus === 'unavailable' && <Notice tone="warning">Windows could not provide a usable route gateway. No local connection result was assumed.</Notice>}
    {result.routeStable !== true && <Notice tone="warning">{result.routeStable === false ? 'The selected route changed during this check. Repeat the check before comparing these results.' : 'Route consistency could not be verified. These samples cannot establish that both destinations used the same connection.'}</Notice>}
    <Notice>Missing gateway replies may mean the router blocks or limits ICMP. Consistent gateway replies with inconsistent internet replies suggest checking the wider path, but do not identify a faulty device. VPNs and changing traffic can affect both tests.</Notice>
    <p className="accounting-note">This is an IPv4 gateway comparison, not a full route trace, bandwidth test or game-server latency measurement. Route addresses are not included in reports or logs.</p>
  </section>;
}
