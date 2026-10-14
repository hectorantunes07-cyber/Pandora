import { useEffect, useState } from 'react';
import { MousePointer2, RefreshCw } from 'lucide-react';
import type { CursorInfo } from '../shared/types';
import { api, errorMessage, isDesktop } from './api';
import { Badge, Modal, Notice, PanelTitle, Spinner } from './components';

export function updateInterfaceCursor(info: CursorInfo) {
  const a = info.selected;
  if (info.useInApp && a && /^data:image\/x-icon;base64,[A-Za-z0-9+/=]+$/.test(a.cssCursor) && Number.isInteger(a.x) && Number.isInteger(a.y)) {
    document.documentElement.style.setProperty('--personal-cursor', `url("${a.cssCursor}") ${a.x} ${a.y}, auto`);
    document.documentElement.dataset.personalCursor = 'true';
  } else { delete document.documentElement.dataset.personalCursor; document.documentElement.style.removeProperty('--personal-cursor'); }
}
export function CursorCustomization({ onBusyChange, restoreOnly = false }: { onBusyChange: (value: boolean) => void; restoreOnly?: boolean }) {
  const [info, setInfo] = useState<CursorInfo | null>(null), [review, setReview] = useState<{ info: CursorInfo; restore: boolean } | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [result, setResult] = useState('');
  const accept = (i: CursorInfo) => { setInfo(i); updateInterfaceCursor(i); };
  const load = async () => { try { accept(await api.getCursor()); } catch (e) { setError(errorMessage(e)); setInfo(null); } };
  useEffect(() => { if (isDesktop) void load(); }, []);
  const run = async (fn: () => Promise<void>) => { if (busy) return; setBusy(true); onBusyChange(true); setError(''); try { await fn(); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); onBusyChange(false); } };
  const select = (bundled: boolean) => run(async () => { const next = await api.selectCursor(bundled); if (next) accept(next); });
  const preview = (restore: boolean) => run(async () => { const fresh = await api.getCursor(); accept(fresh); setReview({ info: fresh, restore }); });
  const apply = () => run(async () => {
    if (!review?.info.token) return;
    try { const r = await api.changeCursor(review.info.token, review.restore); setResult(r.message); if (!r.success) setError('The operation could not be fully verified. Review the result below.'); await load(); } finally { setReview(null); }
  });
  if (restoreOnly && !info?.managed && !error) return null;
  const image = info?.selected?.preview ?? './cursors/sonnier.png';
  return <section className="panel cursor-manager"><PanelTitle icon={MousePointer2} title="Cursor Customization" action={<Badge>{info?.managed ? 'NORMAL POINTER MANAGED' : 'OPTIONAL'}</Badge>}/><p>Use a custom normal pointer and keep the rest of your Windows cursor scheme. Your original pointer is saved before any change.</p>
    {!restoreOnly && <><div className="cursor-previews"><div className="cursor-preview current-pointer"><span className="field-label">Current Windows pointer</span><div className="cursor-canvas">{info?.currentPreview ? <img src={info.currentPreview} alt="Current Windows normal pointer"/> : <MousePointer2 size={32}/>}</div><p>{info?.currentPreview ? 'Read from the active Windows arrow.' : 'Preview unavailable. Hover here to see your active pointer.'}</p></div><div className="cursor-preview"><span className="field-label">Selected pointer</span><div className="cursor-canvas"><img src={image} alt="Selected custom cursor"/></div><strong>{info?.selected?.name ?? 'Sonnier’s cursor'}</strong><p>{info?.selected ? `${info.selected.width} × ${info.selected.height} · hotspot ${info.selected.x}, ${info.selected.y}` : '32 × 32 · hotspot 15, 16'}{info?.selected?.kind === 'ani' ? ' · first-frame preview' : ''}</p></div></div>
    <div className="button-row"><button className="button secondary" disabled={!isDesktop || busy} onClick={() => void select(false)}>Choose .cur or .ani file</button><button className="button secondary" disabled={!isDesktop || busy} onClick={() => void select(true)}>Use Sonnier’s cursor</button></div><label className="cursor-option"><input type="checkbox" checked={info?.useInApp ?? false} disabled={!isDesktop || busy || !info?.selected} onChange={e => { const checked = e.target.checked; void run(async () => accept(await api.setAppCursor(checked))); }}/>Use selected cursor inside PANDORA</label><p className="accounting-note">Interface use is separate from Windows. Animated files use a static first frame inside PANDORA. Text selection, resizing and unavailable controls keep their usual pointers.</p></>}
    <div className="button-row"><button className="button secondary" disabled={!isDesktop || busy} onClick={() => void run(load)}><RefreshCw size={15}/>Refresh cursor</button>{!restoreOnly && <button className="button primary" disabled={!info?.supported || !info.current || !info.selected || info.managed || busy} onClick={() => void preview(false)}>Apply Cursor</button>}<button className="button secondary" disabled={!info?.managed || !info.current || info.conflict || busy} onClick={() => void preview(true)}>Restore Default</button></div><p className="accounting-note">Restore Default restores the original normal pointer saved by PANDORA, including a previous custom pointer. Cursor files stay in local app data for future Windows sign-ins.</p>
    {error && <Notice tone="error">{error}</Notice>}{info?.reason && <Notice tone="warning">{info.reason}</Notice>}{info?.conflict && <Notice tone="warning">The normal pointer was changed outside PANDORA. That change is preserved; automatic restoration is blocked.</Notice>}{result && <Notice>{result}</Notice>}
    {review && <Modal title={review.restore ? 'Restore your original normal pointer?' : 'Apply the selected normal pointer?'} description="Only the Windows normal pointer is changed. The exact original registry value and type are saved, then Windows reloads its cursor configuration." busy={busy} onClose={() => setReview(null)} footer={<><button className="button secondary" disabled={busy} onClick={() => setReview(null)}>Cancel</button><button className="button primary" disabled={busy || !review.info.token || review.info.conflict || (!review.restore && !review.info.selected)} onClick={() => void apply()}>{busy ? <Spinner label="Verifying cursor…"/> : 'Confirm cursor change'}</button></>}><dl className="detail-list"><div><dt>Current pointer</dt><dd>{review.info.current?.value || 'Windows scheme default'}</dd></div><div><dt>New pointer</dt><dd>{review.restore ? review.info.original?.value || 'Saved Windows scheme default' : review.info.selected?.name}</dd></div></dl><Notice>Other roles, including text, busy and resize pointers, retain their settings. Windows policy or cursor-management software may prevent a change or overwrite it later. Verify the pointer again after restarting Windows.</Notice></Modal>}
  </section>;
}
