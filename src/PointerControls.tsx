import { useEffect, useState } from 'react';
import { MousePointer2, RefreshCw } from 'lucide-react';
import type { PointerInfo } from '../shared/types';
import { api, errorMessage, isDesktop } from './api';
import { Badge, Modal, Notice, PanelTitle, Spinner } from './components';
export function PointerControls({ onBusyChange, restoreOnly = false }: { onBusyChange: (busy: boolean) => void; restoreOnly?: boolean }) {
  const [info, setInfo] = useState<PointerInfo | null>(null), [review, setReview] = useState<{ info: PointerInfo; restore: boolean } | null>(null);
  const [reading, setReading] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const load = async () => { setReading(true); setError(''); try { setInfo(await api.getPointer()); } catch (e) { setError(errorMessage(e)); setInfo(null); } finally { setReading(false); } };
  useEffect(() => { if (isDesktop) void load(); }, []);
  const preview = async (restore: boolean) => {
    setReading(true); setError('');
    try { const fresh = await api.getPointer(); setInfo(fresh); setReview({ info: fresh, restore }); } catch (e) { setError(errorMessage(e)); } finally { setReading(false); }
  };
  const apply = async () => {
    if (!review?.info.token || busy) return;
    setBusy(true); onBusyChange(true); setError(''); setResult(null);
    try { setResult(await api.changePointer(review.info.token, review.restore)); setReview(null); await load(); } catch (e) { setError(errorMessage(e)); setReview(null); } finally { setBusy(false); onBusyChange(false); }
  };
  if (restoreOnly && !info?.managed && !error) return null;
  const unavailable = !isDesktop || !info?.supported || !info.current || reading || busy;
  return <section className="panel pointer-controls"><PanelTitle icon={MousePointer2} title="Windows pointer acceleration" action={<Badge tone={info?.conflict ? 'amber' : 'purple'}>{info?.conflict ? 'CONFLICT' : info?.managed ? 'MANAGED' : 'OPTIONAL · LOW RISK'}</Badge>}/><p className="benchmark-note">Disabling acceleration can make desktop pointer movement more consistent for your preference. Games that use raw mouse input may ignore this setting. This does not change mouse DPI, polling rate, sensitivity or measured input latency.</p><p className="accounting-note">Current Windows API mode: {info?.current ? info.current[2] === 0 ? 'Acceleration off' : `Acceleration on (mode ${info.current[2]})` : 'Unavailable'}. Current user · no administrator required · takes effect immediately; applications may need reopening.</p>
    <div className="power-actions"><button className="button secondary" disabled={!isDesktop || reading || busy} onClick={() => void load()}><RefreshCw size={14}/>Refresh pointer</button>{!restoreOnly && <button className="button primary" disabled={Boolean(unavailable || info?.managed || info?.current?.[2] === 0)} onClick={() => void preview(false)}>Review acceleration off</button>}<button className="button secondary" disabled={Boolean(unavailable || !info?.managed || info?.conflict)} onClick={() => void preview(true)}>Review original pointer</button></div>
    {error && <Notice tone="error">{error}</Notice>}{info?.reason && <Notice tone="warning">{info.reason}</Notice>}{info?.conflict && <Notice tone="warning">Pointer values changed outside PANDORA. That change is preserved; the original API values remain saved.</Notice>}{result && <Notice tone={result.success ? 'success' : 'warning'}>{result.message}</Notice>}
    {review && <Modal title={review.restore ? 'Restore original pointer behavior?' : 'Turn off Windows pointer acceleration?'} description="This uses the documented SystemParametersInfo API. Exact effective API values are saved before writing and verified afterward. No hardware or game-file settings are changed." onClose={() => setReview(null)} busy={busy} footer={<><button className="button secondary" disabled={busy} onClick={() => setReview(null)}>Cancel</button><button className="button primary" disabled={busy || !review.info.token || review.info.conflict || !review.info.current} onClick={() => void apply()}>{busy ? <Spinner label="Verifying pointer change…"/> : 'Confirm pointer change'}</button></>}><dl className="detail-list"><div><dt>Current values</dt><dd>{review.info.current?.join(', ') ?? 'Unavailable'}</dd></div><div><dt>Proposed values</dt><dd>{review.restore ? review.info.original?.join(', ') : review.info.current ? [review.info.current[0], review.info.current[1], 0].join(', ') : 'Unavailable'}</dd></div></dl><Notice>Values are threshold 1, threshold 2 and acceleration mode. PANDORA preserves the thresholds and changes only acceleration when applying. Rollback restores all three saved API values and refuses external changes. Your pointer may feel different immediately; no FPS benefit is promised.</Notice></Modal>}
  </section>;
}
