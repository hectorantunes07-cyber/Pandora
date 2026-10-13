import { useEffect, useState } from 'react';
import { Layers, RotateCcw, ShieldCheck } from 'lucide-react';
import { PROFILE_DEFINITIONS, type ProfileId, type ProfilePreview, type ProfileStatus } from '../shared/profiles';
import type { OperationResult, TweakState } from '../shared/types';
import { api, errorMessage, isDesktop } from './api';
import { Badge, Modal, Notice, PanelTitle, Spinner } from './components';

export function ProfileControls({ tweaks, refreshTweaks, onBusyChange, restoreOnly = false }: { tweaks: TweakState[]; refreshTweaks: () => Promise<void>; onBusyChange: (busy: boolean) => void; restoreOnly?: boolean }) {
  const [status, setStatus] = useState<ProfileStatus | null>(null);
  const [selected, setSelected] = useState<ProfileId>('balanced');
  const [custom, setCustom] = useState<string[]>([]);
  const [review, setReview] = useState<ProfilePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<OperationResult[]>([]);
  const load = async () => {
    if (!isDesktop) return;
    try { const next = await api.getProfile(); setStatus(next); if (next.customIds) setCustom(next.customIds); }
    catch (err) { setError(errorMessage(err)); }
  };
  useEffect(() => { void load(); }, []);
  const preview = async (id: ProfileId | null) => {
    setReading(true); setError('');
    try { setReview(await api.previewProfile(id, custom)); }
    catch (err) { setError(errorMessage(err)); }
    finally { setReading(false); }
  };
  const apply = async () => {
    if (!review || busy) return;
    setBusy(true); onBusyChange(true); setError(''); setResults([]);
    try { setResults(await api.applyProfile(review.token)); setReview(null); await load(); await refreshTweaks(); }
    catch (err) { setError(errorMessage(err)); setReview(null); await load(); await refreshTweaks(); }
    finally { setBusy(false); onBusyChange(false); }
  };
  const chosen = PROFILE_DEFINITIONS.find(p => p.id === selected)!;
  return <section className="panel profile-controls">
    <PanelTitle icon={Layers} title={restoreOnly ? 'Profile restoration' : 'Your Windows preset'} action={<Badge tone={status?.complete ? 'green' : 'amber'}>{status?.selection ? `${PROFILE_DEFINITIONS.find(p => p.id === status.selection!.id)?.title} · ${status.complete ? 'configured' : 'needs review'}` : status?.ownedIds.length ? 'RESTORATION NEEDS REVIEW' : 'NO PROFILE SELECTED'}</Badge>}/>
    {error && <Notice tone="error">{error}</Notice>}
    {!restoreOnly && <><label className="field">Preset<select className="select" aria-label="Windows preset" value={selected} disabled={busy || reading} onChange={event => setSelected(event.target.value as ProfileId)}>{PROFILE_DEFINITIONS.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label><p>{chosen.description}</p><p className="benchmark-note">{chosen.tradeoff}</p>
    {selected === 'custom' && <div className="profile-custom">{tweaks.map(t => <label key={t.id}><input type="checkbox" disabled={busy || reading} aria-label={`Custom profile: ${t.title}`} checked={custom.includes(t.id)} onChange={() => setCustom(ids => ids.includes(t.id) ? ids.filter(id => id !== t.id) : [...ids, t.id])}/><span>{t.title}</span><small>{t.state}</small></label>)}</div>}</>}
    <div className="power-actions">{!restoreOnly && <button className="button primary" disabled={!isDesktop || busy || reading} onClick={() => void preview(selected)}><ShieldCheck size={16}/>Review preset</button>}<button className="button secondary" disabled={!isDesktop || busy || reading || (!status?.selection && !status?.ownedIds.length)} onClick={() => void preview(null)}><RotateCcw size={15}/>Review profile off</button></div>
    {reading && <Spinner label="Checking settings and conflicts…"/>}
    <p className="benchmark-note">Profiles change only the listed Windows preferences, not game files or power plans. Switching restores changes owned by the previous profile before applying new ones. Individually applied settings and external customizations are preserved. Partial outcomes remain visible in Restore & History.</p>
    {results.length > 0 && <div className="operation-results" role="region" aria-label="Profile results">{results.map((r, i) => <Notice key={`${r.id}-${i}`} tone={r.success ? 'success' : 'warning'}><strong>{tweaks.find(t => t.id === r.id)?.title ?? r.id}</strong> · {r.message}</Notice>)}</div>}
    {review && <Modal title={review.selection ? `Review ${PROFILE_DEFINITIONS.find(p => p.id === review.selection!.id)?.title}` : 'Turn off the managed profile?'} description="Review changes, preserved preferences and unavailable items. Only the reviewed settings are eligible; the review expires after five minutes or a state change." busy={busy} onClose={() => setReview(null)} footer={<><button className="button secondary" disabled={busy} onClick={() => setReview(null)}>Cancel</button><button className="button primary" disabled={busy || review.blocked} onClick={() => void apply()}>{busy ? <Spinner label="Applying reviewed preset…"/> : 'Confirm preset changes'}</button></>}>
      {review.changes.length === 0 && <Notice>No Windows preferences need changing.</Notice>}
      {review.changes.map(c => <section className="restore-preview" key={c.id}><h3>{c.title} <Badge>{c.action}</Badge></h3><p>{c.reason}</p><dl className="detail-list"><div><dt>Value</dt><dd>{c.from ?? 'Not explicitly set'} → {c.to ?? 'Remove added value'}</dd></div><div><dt>After change</dt><dd>{c.restart}</dd></div></dl><details><summary>Exact setting</summary><code>{c.target}</code></details></section>)}
      {review.blocked && <Notice tone="warning">Resolve the listed conflicts in Restore & History before switching profiles. No external settings will be overwritten.</Notice>}
      {review.changes.some(c => c.action === 'skip') && <Notice tone="warning">Unavailable preferences will be skipped; this preset may remain partially configured.</Notice>}
    </Modal>}
  </section>;
}
