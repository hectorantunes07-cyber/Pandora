import { useEffect, useState } from 'react';
import { Layers, RefreshCw } from 'lucide-react';
import type { StartupControl } from '../shared/types';
import { api, errorMessage, isDesktop } from './api';
import { Badge, Modal, Notice, PanelTitle, Spinner } from './components';
export function StartupControls({ onBusyChange, restoreOnly = false }: { onBusyChange: (busy: boolean) => void; restoreOnly?: boolean }) {
  const [items, setItems] = useState<StartupControl[]>([]);
  const [review, setReview] = useState<StartupControl | null>(null);
  const [busy, setBusy] = useState(false), [reading, setReading] = useState(false);
  const [error, setError] = useState(''), [result, setResult] = useState('');
  const load = async () => {
    if (!isDesktop) return;
    setReading(true); setError('');
    try { setItems(await api.getStartupControls()); } catch (err) { setError(errorMessage(err)); }
    finally { setReading(false); }
  };
  useEffect(() => { void load(); }, []);
  const apply = async () => {
    if (!review?.token || busy) return;
    setBusy(true); onBusyChange(true); setError(''); setResult('');
    try { const result = await api.changeStartup(review.token, review.managed); setResult(result.message); setReview(null); await load(); }
    catch (err) { setError(errorMessage(err)); setReview(null); }
    finally { setBusy(false); onBusyChange(false); }
  };
  const visible = items.filter(i => restoreOnly ? i.managed : i.status !== 'not-present');
  return <section className="panel startup-controls"><PanelTitle icon={Layers} title={restoreOnly ? 'Startup entry backups' : 'Manage supported launcher startup'} action={<button className="button secondary compact" disabled={!isDesktop || busy || reading} onClick={() => void load()}><RefreshCw size={14}/>Refresh startup controls</button>}/>
    <p className="benchmark-note">These controls manage the current account’s named Discord, Steam, Epic Games Launcher and Spotify Run entries. They do not stop running apps, modify StartupApproved, services or tasks, or verify publishers. An app may recreate its entry. Use Windows startup settings for other apps.</p>
    {error && <Notice tone="error">{error}</Notice>}{result && <Notice>{result}</Notice>}{reading && <Spinner label="Checking startup entries and backups…"/>}
    {visible.map(item => <div className="startup-control-row" key={item.id}><div><strong>{item.name}</strong><Badge tone={item.managed ? 'purple' : ''}>{item.status}</Badge><p className="benchmark-note">{item.reason}</p></div><button className="button secondary compact" disabled={!item.token || busy || reading || item.status === 'conflict' || item.status === 'unavailable'} onClick={() => setReview(item)}>{item.managed ? `Restore ${item.name} startup` : `Disable ${item.name} startup`}</button></div>)}
    {!reading && !visible.length && <p className="panel-empty">{restoreOnly ? 'No managed startup entries need restoration.' : isDesktop ? 'No supported launcher Run entries were found.' : 'Open the Windows app to inspect and manage startup entries.'}</p>}
    {review && <Modal title={review.managed ? `Restore ${review.name} startup?` : `Disable ${review.name} startup?`} description={review.managed ? 'Restore the exact saved registry value type and command. Existing Windows startup approval settings still apply.' : 'Remove only this account’s named Run entry after saving its exact original command and registry value type. This affects future sign-ins; the running app stays open.'} busy={busy} onClose={() => setReview(null)} footer={<><button className="button secondary" disabled={busy} onClick={() => setReview(null)}>Cancel</button><button className="button primary" disabled={busy} onClick={() => void apply()}>{busy ? <Spinner/> : review.managed ? 'Confirm startup restore' : 'Confirm startup disable'}</button></>}>
      <dl className="detail-list"><div><dt>Current command</dt><dd><code>{review.current ?? 'No Run entry'}</code></dd></div>{review.original && <div><dt>Saved original command</dt><dd><code>{review.original}</code></dd></div>}</dl>
      <Notice tone="warning">The entry’s name is not proof of publisher identity. Review the command before proceeding. External replacements are preserved. You can restore PANDORA’s saved entry from this page or Restore & History.</Notice>
    </Modal>}
  </section>;
}
