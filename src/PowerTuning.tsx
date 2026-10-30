import { useEffect, useRef, useState } from 'react';
import { Gauge, RefreshCw } from 'lucide-react';
import { POWER_CONTROLS, powerValueLabel, type PowerSource, type PowerTuningInfo, type PowerTuningReview } from '../shared/power-tuning';
import { api, errorMessage, isDesktop } from './api';
import { Badge, Modal, Notice, PanelTitle, Spinner } from './components';
type Props = { onBusyChange: (busy: boolean) => void; restoreOnly?: boolean };
export function PowerTuning({ onBusyChange, restoreOnly = false }: Props) {
  const [source, setSource] = useState<PowerSource>('ac'), [busy, setBusy] = useState(false);
  const running = useRef(new Set<PowerSource>());
  const changeBusy = (source: PowerSource, value: boolean) => {
    if (value) running.current.add(source); else running.current.delete(source);
    const active = running.current.size > 0; setBusy(active); onBusyChange(value);
  };
  if (restoreOnly) return <>{(['ac', 'dc'] as const).map(source => <PowerPolicyPanel key={source} source={source} restoreOnly onBusyChange={value => changeBusy(source, value)}/>)}</>;
  return <div className="power-policy-center">
    <div className="tabs" aria-label="Power source">{(['ac', 'dc'] as const).map(value => <button key={value} className={`tab ${source === value ? 'active' : ''}`} aria-pressed={source === value} disabled={busy} onClick={() => setSource(value)}>{value === 'ac' ? 'Plugged in' : 'On battery'}</button>)}</div>
    <PowerPolicyPanel key={source} source={source} onBusyChange={value => changeBusy(source, value)}/>
  </div>;
}
function PowerPolicyPanel({ source, onBusyChange, restoreOnly = false }: Props & { source: PowerSource }) {
  const battery = source === 'dc';
  const title = battery ? 'Battery power controls' : 'Advanced power controls';
  const opposite = battery ? 'Plugged-in' : 'Battery';
  const description = (text: string) => battery ? text.replaceAll('while plugged in', 'while on battery').replaceAll('plugged-in', 'battery') : text;
  const [info, setInfo] = useState<PowerTuningInfo | null>(null), [choices, setChoices] = useState<Record<string, number>>({}), [review, setReview] = useState<PowerTuningReview | null>(null);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [result, setResult] = useState('');
  const load = async () => { setInfo(null); setChoices({}); const i = await api.getPowerTuning(source); setInfo(i); setChoices(Object.fromEntries(i.states.filter(s => s.current !== null).map(s => [s.id, s.current!]))); };
  const run = async (fn: () => Promise<void>) => { if (pending.current) return; pending.current = true; setBusy(true); onBusyChange(true); setError(''); try { await fn(); } catch (e) { setError(errorMessage(e)); } finally { pending.current = false; setBusy(false); onBusyChange(false); } };
  useEffect(() => { if (isDesktop) void run(load); }, []);
  const preview = (id: string, restore: boolean) => run(async () => setReview(await api.previewPowerTuning(id, restore ? null : choices[id], restore, source)));
  const apply = () => run(async () => { if (!review) return; try { const r = await api.changePowerTuning(review.token, source); setResult(r.message); if (!r.success) setError('The power change could not be fully verified.'); await load(); } finally { setReview(null); } });
  const definitions = POWER_CONTROLS.filter(c => !restoreOnly || info?.states.some(s => s.id === c.id && s.managed));
  if (restoreOnly && !definitions.length && !error) return null;
  const selected = POWER_CONTROLS.find(c => c.id === review?.id);
  return <section className="power-tuning" aria-label={title}><PanelTitle icon={Gauge} title={title} action={<button className="button secondary compact" disabled={!isDesktop || busy} onClick={() => void run(load)}><RefreshCw size={15}/>Refresh power values</button>}/><p className="benchmark-note">CPU and PCIe policy controls for {battery ? 'battery use' : 'plugged-in use'}. {opposite} values are preserved. Windows power mode, firmware and OEM software can override effective behavior; compare results in Performance Lab.</p>
    {info?.planId && <p className="accounting-note">Plan: <code>{info.planId}</code> · {info.planId === info.activePlanId ? 'Currently active' : 'Inactive saved plan — restore its managed changes before editing another plan'}</p>}{error && <Notice tone="error">{error}</Notice>}{info?.reason && <Notice tone="warning">{info.reason}</Notice>}{result && <Notice>{result}</Notice>}
    <div className="tweak-grid">{definitions.map(c => { const state = info?.states.find(s => s.id === c.id); const current = state?.current ?? null; const choice = choices[c.id]; const options = current !== null && !c.options.some(o => o.value === current) ? [{ value: current, label: `Current: ${current}` }, ...c.options] : c.options; return <article className="tweak-card" key={c.id}><div className="tweak-top"><span className="tweak-category">{battery ? 'Battery' : 'Plugged-in'} power policy</span><Badge tone="amber">Review tradeoffs</Badge></div><h3>{c.title}</h3><p>{description(c.description)}</p><p className="power-current"><strong>Current:</strong> {powerValueLabel(c.id, current)}</p>{!restoreOnly && !state?.managed && <label className="power-choice">Proposed value<select aria-label={c.title} disabled={busy || !info?.canApply || current === null || info?.activePlanId !== info?.planId} value={choice ?? ''} onChange={e => setChoices(prev => ({ ...prev, [c.id]: Number(e.target.value) }))}>{current === null && <option value="">Unavailable on this plan</option>}{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>}<details><summary>Performance & power tradeoff</summary><p>{c.tradeoff}</p></details><div className="tweak-bottom"><span className="tweak-state">{state?.conflict ? 'External change preserved' : state?.managed ? 'Original backed up' : current === null ? 'Unavailable' : !info?.canApply ? 'Read only' : 'Ready to review'}</span><button className="button secondary compact" disabled={busy || current === null || state?.conflict || (!state?.managed && (!info?.canApply || choice === current || info?.activePlanId !== info?.planId))} onClick={() => void preview(c.id, Boolean(state?.managed))}>{state?.managed ? 'Review restore' : 'Review power change'}</button></div></article>; })}</div>
    {review && selected && <Modal title={review.restore ? `Restore ${selected.title.toLowerCase()}?` : selected.title} description={`This changes one ${battery ? 'battery' : 'plugged-in'} power-plan value. The original is saved before writing, then Windows is asked to refresh the plan if it is active.`} onClose={() => setReview(null)} busy={busy} footer={<><button className="button secondary" disabled={busy} onClick={() => setReview(null)}>Cancel</button><button className="button primary" disabled={busy} onClick={() => void apply()}>{busy ? <Spinner label="Verifying power policy…"/> : 'Confirm power setting'}</button></>}><dl className="detail-list"><div><dt>Current</dt><dd>{powerValueLabel(review.id, review.current)}</dd></div><div><dt>After change</dt><dd>{powerValueLabel(review.id, review.desired)}</dd></div><div><dt>Plan</dt><dd><code>{review.planId}</code></dd></div><div><dt>Tradeoff</dt><dd>{selected.tradeoff}</dd></div></dl><Notice>{opposite} settings are unchanged. {battery && 'Favoring performance can shorten battery life and increase heat. '} This is a plan-level setting affecting applications that use the plan. Windows may deny writes because of permissions or policy. Availability of a stored value does not prove that your hardware uses it. No clock speed or FPS gain is guaranteed.</Notice></Modal>}
  </section>;
}
