import { useMemo, useRef, useState } from 'react';
import { Activity, Search } from 'lucide-react';
import type { ProcessActivity as Sample } from '../shared/process-activity';
import { api, errorMessage, formatBytes, isDesktop } from './api';
import { Badge, Notice, PanelTitle, Spinner } from './components';
const seconds = (ms: number | null) => ms === null ? 'Unavailable' : `${(ms / 1000).toFixed(2)} s`;
export function ProcessActivity() {
  const [result, setResult] = useState<Sample | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [search, setSearch] = useState(''), [limit, setLimit] = useState(10), [sort, setSort] = useState<'cpu' | 'memory'>('cpu');
  const pending = useRef(false);
  const sample = async () => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setResult(null); setError(''); setLimit(10);
    try { setResult(await api.sampleProcessActivity()); } catch (e) { setError(errorMessage(e)); }
    finally { pending.current = false; setBusy(false); }
  };
  const rows = useMemo(() => (result?.rows ?? []).filter(row => `${row.name} ${row.pid}`.toLowerCase().includes(search.trim().toLowerCase())).sort((a, b) => (sort === 'cpu' ? (b.cpuPercent ?? -1) - (a.cpuPercent ?? -1) : (b.memoryBytes ?? -1) - (a.memoryBytes ?? -1)) || a.pid - b.pid), [result, search, sort]);
  return <section className="panel process-activity" aria-label="Process CPU activity">
    <PanelTitle icon={Activity} title="CPU activity sample" action={<Badge>READ ONLY</Badge>}/>
    <p className="benchmark-note">Compare processor time across two readings, separated by a two-second wait. Sampling runs only when requested and does not stop apps or change their priority.</p>
    <button className="button primary" disabled={!isDesktop || busy} onClick={() => void sample()}>{busy ? <Spinner label="Sampling process activity…"/> : 'Measure CPU activity'}</button>
    {busy && <p role="status" className="accounting-note">Reading process identities and counters. Windows provider overhead can make this take longer than two seconds.</p>}
    {error && <Notice tone="error">{error}</Notice>}
    {result && <>
      <div className="process-toolbar"><label className="search-field"><Search size={16}/><input aria-label="Search sampled processes" value={search} placeholder="Search measured processes…" onChange={e => { setSearch(e.target.value); setLimit(10); }}/></label><select className="select" aria-label="Sort sampled processes" value={sort} onChange={e => setSort(e.target.value as 'cpu' | 'memory')}><option value="cpu">Highest CPU activity</option><option value="memory">Highest working set</option></select></div>
      <p className="accounting-note">Completed {new Date(result.timestamp).toLocaleString()} · {result.logicalProcessors ?? 'Unknown'} logical processors · measured intervals {result.minIntervalMs === null || result.maxIntervalMs === null ? 'unavailable' : `${seconds(result.minIntervalMs)}–${seconds(result.maxIntervalMs)}`}.</p>
      {!result.logicalProcessors && <Notice tone="warning">The logical processor count was unavailable or changed. Normalized CPU percentages cannot be calculated.</Notice>}
      {result.truncated && <Notice tone="warning">A snapshot exceeded the 512-process limit. This is a partial sample; missing rows do not prove a process exited.</Notice>}
      {rows.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th scope="col">Process</th><th scope="col">PID</th><th scope="col">CPU share</th><th scope="col">Working set</th><th scope="col">Sample status</th></tr></thead><tbody>{rows.slice(0, limit).map(row => <tr key={row.pid}><td><strong>{row.name}</strong></td><td>{row.pid}</td><td>{row.cpuPercent === null ? 'Unavailable' : `${row.cpuPercent.toFixed(1)}%`}</td><td>{formatBytes(row.memoryBytes, 1)}</td><td>{row.status === 'measured' ? seconds(row.intervalMs) : row.status === 'new-or-replaced' ? 'New or replaced process' : 'Counters or identity unavailable'}</td></tr>)}</tbody></table></div> : <p className="panel-empty">{search ? 'No sampled processes match your search.' : 'No process rows were returned.'}</p>}
      {rows.length > limit && <button className="button secondary" onClick={() => setLimit(value => value + 20)}>Show more sampled processes</button>}
      <p className="accounting-note">{result.noLongerObserved} previously listed process IDs were not observed in the second snapshot. Protected processes, exits and reused IDs can prevent a measurement.</p>
      <Notice>CPU share is average processor time divided by elapsed time and the reported logical processor count; 100% represents all logical processors. It differs from frequency-adjusted Task Manager utilization. Working set is the final reading. Collection adds some load, and a short sample does not measure startup impact or prove an app slows your game.</Notice>
    </>}
  </section>;
}
