import { useEffect, useState } from 'react';
import { Monitor, RefreshCw } from 'lucide-react';
import { VISUAL_EFFECTS, VISUAL_EFFECTS_REFERENCE, type VisualEffectState } from '../shared/visual-effects';
import { api, errorMessage, isDesktop } from './api';
import { Badge, Modal, Notice, PanelTitle, Spinner } from './components';
export function VisualEffects({ onBusyChange, restoreOnly = false }: { onBusyChange: (busy: boolean) => void; restoreOnly?: boolean }) {
  const [states, setStates] = useState<VisualEffectState[]>([]), [reading, setReading] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [review, setReview] = useState<{ state: VisualEffectState; restore: boolean } | null>(null);
  const load = async () => { setReading(true); setError(''); try { setStates(await api.getVisualEffects()); } catch (e) { setError(errorMessage(e)); setStates([]); } finally { setReading(false); } };
  useEffect(() => { if (isDesktop) void load(); }, []);
  const preview = async (id: string, restore: boolean) => {
    setReading(true); setError('');
    try { const fresh = await api.getVisualEffects(); setStates(fresh); const state = fresh.find(s => s.id === id); if (state?.token) setReview({ state, restore }); else setError('This Windows preference is unavailable. Refresh before reviewing again.'); }
    catch (e) { setError(errorMessage(e)); } finally { setReading(false); }
  };
  const apply = async () => {
    if (!review?.state.token || busy) return;
    setBusy(true); onBusyChange(true); setError(''); setResult(null);
    try { setResult(await api.changeVisualEffect(review.state.token, review.restore)); setReview(null); await load(); }
    catch (e) { setError(errorMessage(e)); setReview(null); } finally { setBusy(false); onBusyChange(false); }
  };
  const definitions = VISUAL_EFFECTS.filter(e => !restoreOnly || states.some(s => s.id === e.id && s.managed));
  if (restoreOnly && !definitions.length && !error) return null;
  const selected = VISUAL_EFFECTS.find(e => e.id === review?.state.id);
  return <section className="visual-effects" aria-label="Windows visual effects"><PanelTitle icon={Monitor} title="Windows visual effects" action={<button className="button secondary compact" disabled={!isDesktop || reading || busy} onClick={() => void load()}><RefreshCw size={14}/>Refresh effects</button>}/><p className="benchmark-note">Optional desktop preferences for supported Windows controls. These do not change game graphics or promise higher FPS. Apps can use their own effects.</p>
    {error && <Notice tone="error">{error}</Notice>}{result && <Notice tone={result.success ? 'success' : 'warning'}>{result.message}</Notice>}
    <div className="tweak-grid">{definitions.map(e => { const state = states.find(s => s.id === e.id); return <article className="tweak-card" key={e.id}><div className="tweak-top"><span className="tweak-category">Desktop effects</span><Badge tone="green">Low risk</Badge></div><h3>{e.title}</h3><p>{e.description}</p><div className="tweak-bottom"><span className="tweak-state">{state?.current == null ? 'Unavailable' : state.managed ? state.current ? 'Original present' : 'Managed · Off' : state.current ? 'On' : 'Already off'}</span><button className="button secondary compact" disabled={!state?.token || reading || busy || (!state.managed && !state.current)} onClick={() => void preview(e.id, Boolean(state?.managed))}>{state?.managed ? 'Review restore' : 'Review change'}</button></div></article>; })}</div>
    {review && selected && <Modal title={review.restore ? `Restore: ${selected.title}?` : selected.title} description="The original Windows API value is saved before applying and checked after the change." onClose={() => setReview(null)} busy={busy} footer={<><button className="button secondary" disabled={busy} onClick={() => setReview(null)}>Cancel</button><button className="button primary" disabled={busy || !review.state.token} onClick={() => void apply()}>{busy ? <Spinner label="Verifying visual preference…"/> : 'Confirm visual change'}</button></>}><dl className="detail-list"><div><dt>Current effect</dt><dd>{review.state.current ? 'On' : 'Off'}</dd></div><div><dt>After change</dt><dd>{review.restore ? review.state.original ? 'On' : 'Off' : 'Off'}</dd></div><div><dt>Tradeoff</dt><dd>{selected.tradeoff}</dd></div><div><dt>When it applies</dt><dd>Immediately for supported controls; some applications need reopening. No administrator required.</dd></div></dl><a className="text-button" href={VISUAL_EFFECTS_REFERENCE} target="_blank" rel="noreferrer">Microsoft API documentation</a></Modal>}
  </section>;
}
