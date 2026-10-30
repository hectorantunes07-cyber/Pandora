import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import type { OperationResult, RestoreReview } from '../shared/types';
import { api, errorMessage, isDesktop } from './api';
import { Badge, Modal, Notice, PanelTitle, Spinner } from './components';
export function RestoreAll({ onBusyChange, onRestored }: { onBusyChange: (busy: boolean) => void; onRestored: () => Promise<void> }) {
  const [review, setReview] = useState<RestoreReview | null>(null), [last, setLast] = useState<RestoreReview | null>(null);
  const [reading, setReading] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [results, setResults] = useState<OperationResult[]>([]);
  const preview = async () => {
    setReading(true); setError('');
    try { setReview(await api.previewRestoreAll()); } catch (err) { setError(errorMessage(err)); }
    finally { setReading(false); }
  };
  const restore = async () => {
    if (!review || busy) return;
    setBusy(true); onBusyChange(true); setError(''); setResults([]); setLast(review);
    try { setResults(await api.restoreAll(review.token)); setReview(null); await onRestored(); }
    catch (err) { setError(errorMessage(err)); setReview(null); }
    finally { setBusy(false); onBusyChange(false); }
  };
  return <section className="panel global-restore"><PanelTitle icon={RotateCcw} title="Restore all PANDORA-managed changes" action={<Badge>SAVED ORIGINALS ONLY</Badge>}/><p className="benchmark-note">Review preferences, power plans, pointer behavior, launcher startup entries, Fortnite display preferences and the active preset together. External changes are preserved and reported. Cleanup deletions cannot be undone here.</p><button className="button primary" disabled={!isDesktop || reading || busy} onClick={() => void preview()}>{reading ? <Spinner label="Reviewing every backup…"/> : 'Review all managed changes'}</button>
    {error && <Notice tone="error">{error}</Notice>}
    {results.length > 0 && <div role="region" aria-label="Complete restoration results">{results.map(r => <Notice key={r.id} tone={r.success ? 'success' : 'warning'}><strong>{last?.items.find(i => i.id === r.id)?.title ?? r.id}</strong> · {r.message}</Notice>)}</div>}
    {review && <Modal title="Restore reviewed PANDORA changes?" description="This includes only changes with PANDORA-owned backups. Each result is reported separately; conflicts are skipped and backups remain available." onClose={() => setReview(null)} busy={busy} footer={<><button className="button secondary" disabled={busy} onClick={() => setReview(null)}>Cancel</button><button className="button primary" disabled={busy || !review.items.some(i => i.eligible)} onClick={() => void restore()}>{busy ? <Spinner label="Restoring saved originals…"/> : 'Restore eligible changes'}</button></>}>
      {!review.items.length && <Notice>No managed changes need restoration.</Notice>}
      {review.items.map(item => <section className="restore-preview" key={item.id}><h3>{item.title} <Badge tone={item.eligible ? 'green' : 'amber'}>{item.eligible ? 'RESTORE' : 'SKIP / REVIEW'}</Badge></h3><p>{item.reason}</p><dl className="detail-list"><div><dt>Current</dt><dd><code>{item.current}</code></dd></div><div><dt>Saved original</dt><dd><code>{item.original}</code></dd></div></dl></section>)}
    </Modal>}
  </section>;
}
