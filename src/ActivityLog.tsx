import { useEffect, useRef, useState } from 'react';
import { History, RefreshCw, Trash2 } from 'lucide-react';
import { ACTIVITY_ACTIONS, ACTIVITY_STATUS, type ActivityInfo, type ActivityClearReview } from '../shared/activity';
import { api, errorMessage, formatBytes, formatDate, isDesktop } from './api';
import { Badge, Modal, Notice, PanelTitle, Spinner } from './components';
export function ActivityLog({ onBusyChange }: { onBusyChange: (busy: boolean) => void }) {
  const [data, setData] = useState<ActivityInfo | null>(null), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [readError, setReadError] = useState('');
  const [loading, setLoading] = useState(false), [busy, setBusy] = useState(false), [review, setReview] = useState<ActivityClearReview | null>(null);
  const [query, setQuery] = useState(''), [status, setStatus] = useState('all'), [limit, setLimit] = useState(20);
  const pending = useRef(false);
  async function refresh() {
    if (!isDesktop || pending.current) return;
    pending.current = true; setLoading(true);
    try { setData(await api.getActivity()); setReadError(''); } catch (e) { setData(null); setReadError(errorMessage(e)); }
    finally { pending.current = false; setLoading(false); }
  }
  useEffect(() => { void refresh(); const timer = setInterval(() => { if (!document.hidden) void refresh(); }, 10_000); return () => clearInterval(timer); }, []);
  async function preview() {
    if (pending.current) return;
    pending.current = true; setLoading(true); setError(''); setMessage('');
    try { setReview(await api.previewClearActivity()); } catch (e) { setError(errorMessage(e)); }
    finally { pending.current = false; setLoading(false); }
  }
  async function clear() {
    if (!review || pending.current) return;
    pending.current = true; setBusy(true); onBusyChange(true); setError('');
    try { const result = await api.clearActivity(review.token); setMessage(result.message); }
    catch (e) { setError(errorMessage(e)); }
    finally { setReview(null); pending.current = false; setBusy(false); onBusyChange(false); void refresh(); }
  }
  const filtered = data?.entries.filter(e => (status === 'all' || e.status === status) && ACTIVITY_ACTIONS[e.action].toLowerCase().includes(query.toLowerCase())) ?? [];
  return <section className="panel" aria-label="Activity timeline">
    <PanelTitle icon={History} title="Activity timeline" action={<div className="lifecycle-actions"><button className="button secondary compact" disabled={!isDesktop || loading || busy} onClick={() => void refresh()}><RefreshCw size={15}/>Refresh activity</button><button className="button secondary compact" disabled={!data?.available || !data.entries.length || loading || busy} onClick={() => void preview()}><Trash2 size={15}/>Clear activity</button></div>}/>
    <p className="accounting-note">Records operations from this version onward. Keeps the latest {data?.limit ?? 500} entries; clearing activity keeps your rollback backups.</p>
    {readError && <Notice tone="error">{readError}</Notice>}{error && <Notice tone="error">{error}</Notice>}{message && <Notice>{message}</Notice>}{data?.warning && <Notice tone="warning">{data.warning}</Notice>}
    {data?.entries.some(e => e.status === 'unconfirmed' && e.endedAt === null) && <Notice tone="warning">An earlier operation has no recorded outcome. Check its current settings and saved originals before retrying.</Notice>}
    <div className="activity-filters"><label>Find an operation<input aria-label="Find an activity" value={query} onChange={e => { setQuery(e.target.value); setLimit(20); }} placeholder="Power, cursor, cleanup…"/></label><label>Result<select aria-label="Activity result" value={status} onChange={e => { setStatus(e.target.value); setLimit(20); }}><option value="all">All results</option>{Object.entries(ACTIVITY_STATUS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div>
    {loading && !data ? <Spinner label="Reading activity…"/> : !isDesktop ? <p className="panel-empty">Open the Windows app to view activity recorded on your PC.</p> : data?.available && !filtered.length ? <p className="panel-empty">{data.entries.length ? 'No activity matches these filters.' : 'No recorded activity yet.'}</p> : null}
    <div className="history-list">{filtered.slice(0, limit).map(e => <div className="history-row" key={e.id}><div className="history-copy"><div><h3>{ACTIVITY_ACTIONS[e.action]}</h3><Badge tone={e.status === 'completed' ? 'green' : e.status === 'running' ? 'purple' : 'amber'}>{ACTIVITY_STATUS[e.status]}</Badge></div><span>{formatDate(e.startedAt)}{e.endedAt && ` · Finished ${formatDate(e.endedAt)}`}</span>{e.succeeded !== null && <p>{e.succeeded} confirmed · {e.notConfirmed ?? 0} not confirmed</p>}{e.cleanup && <p>{e.cleanup.kind === 'safe' ? 'Temporary files' : e.cleanup.kind === 'browser' ? 'Browser cache' : 'Recycle Bin'} · {formatBytes(e.cleanup.deletedBytes)} logical bytes removed · {e.cleanup.deletedFiles} files · {e.cleanup.skippedFiles} skipped{e.notConfirmed ? ` · ${e.notConfirmed} unconfirmed results` : ''}</p>}</div></div>)}</div>
    {filtered.length > limit && <button className="button secondary compact" onClick={() => setLimit(n => n + 20)}>Show 20 more</button>}
    {data?.available && <p className="accounting-note">{filtered.length} matching entries · {data.discarded} entries removed by retention or clearing{data.clearedAt ? ` · Last cleared ${formatDate(data.clearedAt)}` : ''}</p>}
    <p className="accounting-note">Not confirmed does not mean nothing changed. Private paths, commands, filenames and error details are excluded. Export managed report includes the retained timeline.</p>
    {review && <Modal title="Clear recorded activity?" description={`Remove ${review.count} reviewed entries, including any unconfirmed results. This cannot be undone. Your original setting backups and preference restoration history stay intact.`} busy={busy} onClose={() => setReview(null)} footer={<><button className="button secondary" disabled={busy} onClick={() => setReview(null)}>Cancel</button><button className="button primary" disabled={busy || review.count === 0} onClick={() => void clear()}>Confirm clear activity</button></>}/>}
  </section>;
}
