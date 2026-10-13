import { useEffect, useState } from 'react';
import { BatteryCharging, RefreshCw, RotateCcw } from 'lucide-react';
import type { PowerInfo } from '../shared/types';
import { api, errorMessage, isDesktop } from './api';
import { Badge, Modal, Notice, PanelTitle, Spinner } from './components';

export function PowerControls({ onBusyChange, restoreOnly = false }: { onBusyChange: (busy: boolean) => void; restoreOnly?: boolean }) {
  const [info, setInfo] = useState<PowerInfo | null>(null);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [review, setReview] = useState<{ restore: boolean; expected: string; id: string } | null>(null);
  const refresh = async () => {
    if (!isDesktop) return;
    setReading(true); setError('');
    try { const next = await api.getPower(); setInfo(next); setSelected(next.currentId ?? ''); }
    catch (err) { setError(errorMessage(err)); }
    finally { setReading(false); }
  };
  useEffect(() => { void refresh(); }, []);
  const managed = info?.backup && ['pending', 'applied', 'conflict'].includes(info.backup.status);
  const name = (id: string | null) => info?.plans.find(p => p.id === id)?.name ?? id ?? 'Unavailable';
  const run = async () => {
    if (!review || busy) return;
    setBusy(true); onBusyChange(true); setError(''); setResult('');
    try {
      const outcome = await (review.restore ? api.restorePower(review.expected) : api.applyPower(review.id, review.expected));
      setResult(outcome.message); setReview(null); await refresh();
    } catch (err) { setError(errorMessage(err)); setReview(null); }
    finally { setBusy(false); onBusyChange(false); }
  };
  return <section className="panel power-controls">
    <PanelTitle icon={BatteryCharging} title={restoreOnly ? 'Power-plan backup' : 'Windows power plan'} action={<button className="button secondary compact" disabled={!isDesktop || busy || reading} onClick={() => void refresh()}><RefreshCw size={14}/>Refresh power plans</button>}/>
    {error && <Notice tone="error">{error}</Notice>}{info?.reason && <Notice tone="warning">{info.reason}</Notice>}
    {result && <Notice>{result}</Notice>}
    {reading && <Spinner label="Reading installed power plans…"/>}
    <dl className="detail-list"><div><dt>Active plan</dt><dd>{name(info?.currentId ?? null)}</dd></div>{info?.backup && <><div><dt>Saved original plan</dt><dd>{name(info.backup.originalId)}<small className="power-guid">{info.backup.originalId}</small></dd></div><div><dt>Backup status</dt><dd><Badge>{info.backup.status}</Badge></dd></div></>}</dl>
    {!restoreOnly && <label className="field">Choose an installed plan<select className="select" aria-label="Power plan" value={selected} disabled={!info?.supported || busy || reading || Boolean(managed)} onChange={event => setSelected(event.target.value)}>{!info?.plans.length && <option value="">Windows power plans unavailable</option>}{info?.plans.map(plan => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></label>}
    <div className="power-actions">{!restoreOnly && <button className="button primary" disabled={!info?.supported || !info.currentId || !selected || selected === info.currentId || busy || reading || Boolean(managed)} onClick={() => setReview({ restore: false, expected: info!.currentId!, id: selected })}>Review power-plan change</button>}
    <button className="button secondary" disabled={!managed || !info?.supported || !info.currentId || busy || reading || info.conflict} onClick={() => setReview({ restore: true, expected: info!.currentId!, id: info!.backup!.originalId })}><RotateCcw size={15}/>Restore original power plan</button></div>
    {info?.conflict && <Notice tone="warning">Another app or user changed the active power plan. PANDORA preserves that change. Your original identifier is shown above; automatic restoration is blocked until the active plan matches the saved original or PANDORA selection.</Notice>}
    <p className="benchmark-note">Selecting a plan changes Windows power behavior for the PC. Higher-performance plans can increase heat, fan noise and battery use without improving FPS. Only installed plans are offered; some modern laptops expose only Balanced. Restore your managed plan before selecting another.</p>
    {review && <Modal title={review.restore ? 'Restore your original power plan?' : 'Review power-plan change'} description="Nothing changes until you confirm. PANDORA saves the exact original plan identifier, checks for external changes and verifies the result." onClose={() => setReview(null)} busy={busy} footer={<><button className="button secondary" disabled={busy} onClick={() => setReview(null)}>Cancel</button><button className="button primary" disabled={busy} onClick={() => void run()}>{busy ? <Spinner/> : review.restore ? 'Confirm power-plan restore' : 'Confirm power-plan change'}</button></>}>
      <dl className="detail-list"><div><dt>Current</dt><dd>{name(review.expected)}<small className="power-guid">{review.expected}</small></dd></div><div><dt>Proposed</dt><dd>{name(review.id)}<small className="power-guid">{review.id}</small></dd></div></dl>
      <Notice tone="warning">This may affect power use, thermals and battery life. No plan is created or deleted, and no guaranteed performance gain is claimed. Windows policy may refuse the request.</Notice>
    </Modal>}
  </section>;
}
