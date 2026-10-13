import { useState } from 'react';
import { Globe, Network, RefreshCw } from 'lucide-react';
import type { DnsResult, NetworkInspection as Inventory } from '../shared/types';
import { api, errorMessage, isDesktop } from './api';
import { Badge, Notice, PanelTitle, Spinner } from './components';
export function NetworkInspection() {
  const [inventory, setInventory] = useState<Inventory | null>(null), [dns, setDns] = useState<DnsResult | null>(null);
  const [reading, setReading] = useState(false), [resolving, setResolving] = useState(false);
  const [error, setError] = useState(''), [dnsError, setDnsError] = useState('');
  const inspect = async () => {
    if (reading) return; setReading(true); setError(''); setInventory(null);
    try { setInventory(await api.inspectNetwork()); } catch (err) { setError(errorMessage(err)); } finally { setReading(false); }
  };
  const resolve = async () => {
    if (resolving) return; setResolving(true); setDnsError(''); setDns(null);
    try { setDns(await api.testDns()); } catch (err) { setDnsError(errorMessage(err)); } finally { setResolving(false); }
  };
  return <>
    <section className="panel adapter-inspection"><PanelTitle icon={Network} title="Adapter capabilities" action={<Badge>DIAGNOSTIC · NO CHANGES</Badge>}/><p className="benchmark-note">Inspect up to 64 physical and virtual adapters, including hidden interfaces. A default route is routing configuration; it does not prove which adapter carries your game traffic. Adapter names, addresses and gateway addresses are omitted.</p>
      <button className="button secondary" disabled={!isDesktop || reading} onClick={() => void inspect()}>{reading ? <Spinner label="Reading adapter capabilities…"/> : <><RefreshCw size={15}/>Inspect adapters</>}</button>
      {error && <Notice tone="error">{error}</Notice>}
      {inventory && <><p className="accounting-note">Checked {new Date(inventory.timestamp).toLocaleString()}. Refresh after changing a VPN or adapter configuration.</p>{inventory.adapters.length === 0 && <Notice>No adapter information was returned by Windows.</Notice>}
        {inventory.adapters.map(a => <article className="adapter-card" key={a.index}><div className="adapter-card-heading"><h3>{a.description}</h3><Badge tone={a.physical === true ? 'purple' : ''}>{a.physical === null ? 'TYPE UNAVAILABLE' : a.physical ? 'PHYSICAL' : 'VIRTUAL / SOFTWARE'}</Badge></div><dl className="detail-list"><div><dt>Link state</dt><dd>{a.status}</dd></div><div><dt>Negotiated rate</dt><dd>{a.linkSpeedBits == null ? 'Unavailable' : a.linkSpeedBits >= 1e9 ? `${(a.linkSpeedBits / 1e9).toFixed(1)} Gbps` : `${(a.linkSpeedBits / 1e6).toFixed(0)} Mbps`}</dd></div><div><dt>Default route</dt><dd>{a.defaultRoute === null ? 'Unavailable' : a.defaultRoute ? 'Configured (IPv4 or IPv6)' : 'No default route reported'}</dd></div></dl>
          <details><summary>Driver settings and power-management support</summary><p className="accounting-note">Read-only provider values. Absent properties may be unsupported, permission-restricted, or use an unrecognized vendor keyword. Disabling EEE or interrupt moderation can increase power or CPU use and may not improve latency.</p>
            {a.advanced.length ? a.advanced.map((p, index) => <div className="adapter-property" key={`${p.keyword}-${index}`}><strong>{p.name}</strong><Badge>{p.value}</Badge><small>{p.keyword}{p.options.length ? ` · Driver options: ${p.options.join(' / ')}` : ''}</small></div>) : <p className="accounting-note">Recognized EEE / interrupt-moderation properties unavailable.</p>}
            {a.power.length ? <dl className="detail-list">{a.power.map(p => <div key={p.name}><dt>{p.name}</dt><dd>{p.value}</dd></div>)}</dl> : <p className="accounting-note">Power-management values unavailable; Windows may require administrator permission.</p>}
          </details></article>)}{inventory.notes.map((n, i) => <Notice key={i}>{n}</Notice>)}</>}
    </section>
    <section className="panel adapter-inspection"><PanelTitle icon={Globe} title="DNS resolution check" action={<Badge>ON REQUEST</Badge>}/><p className="benchmark-note">Resolve <code>www.microsoft.com</code> through Windows using your configured resolver. This can send a DNS query; cached answers may be used. No DNS servers are changed. Query duration is not game-server ping or input latency.</p><button className="button secondary" disabled={!isDesktop || resolving} onClick={() => void resolve()}>{resolving ? <Spinner label="Checking DNS resolution…"/> : 'Check DNS resolution'}</button>{dnsError && <Notice tone="error">{dnsError}</Notice>}
      {dns && <div role="region" aria-label="DNS results"><Notice tone={dns.resolved ? 'success' : 'warning'}>{dns.resolved ? `Resolved ${dns.hostname}: ${dns.answerCount} IPv4 ${dns.answerCount === 1 ? 'answer' : 'answers'}, ${dns.elapsedMs.toFixed(1)} ms query duration.` : 'No IPv4 answer was returned for this hostname. Resolver policy, connectivity, missing Windows cmdlets or a timeout can cause this result; it does not establish that all DNS is broken.'}</Notice><p className="accounting-note">Checked {new Date(dns.timestamp).toLocaleString()}. Addresses and server identifiers are not retained.</p></div>}
    </section>
  </>;
}
