import { useEffect, useRef, useState } from 'react';
import { Gamepad2, RefreshCw } from 'lucide-react';
import { FORTNITE_FRAME_CAPS, FORTNITE_LABELS, type FortniteInfo, type FortniteReview, type FortniteValues } from '../shared/fortnite-settings';
import type { OperationResult } from '../shared/types';
import { api, errorMessage, isDesktop } from './api';
import { Badge, Modal, Notice, PanelTitle, Spinner } from './components';

const capLabel = (value: number) => value === 0 ? 'Unlimited' : `${value} FPS`;
export function FortniteSettings({ onBusyChange, restoreOnly = false }: { onBusyChange: (busy: boolean) => void; restoreOnly?: boolean }) {
  const [info, setInfo] = useState<FortniteInfo | null>(null), [draft, setDraft] = useState<FortniteValues | null>(null);
  const [review, setReview] = useState<FortniteReview | null>(null), [result, setResult] = useState<OperationResult | null>(null);
  const [error, setError] = useState(''), [reading, setReading] = useState(false), [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const accept = (next: FortniteInfo) => { setInfo(next); setDraft(next.current); };
  const load = async () => {
    if (pending.current) return;
    pending.current = true; setReading(true); setError('');
    try { accept(await api.getFortniteSettings()); } catch (e) { setInfo(null); setDraft(null); setError(errorMessage(e)); }
    finally { pending.current = false; setReading(false); }
  };
  useEffect(() => { if (isDesktop) void load(); }, []);
  const preview = async (restore: boolean) => {
    if (pending.current) return;
    pending.current = true; setReading(true); setError(''); setResult(null);
    try { setReview(await api.previewFortniteSettings(restore ? null : draft, restore)); }
    catch (e) { setError(errorMessage(e)); }
    finally { pending.current = false; setReading(false); }
  };
  const apply = async () => {
    if (pending.current || !review) return;
    pending.current = true; setBusy(true); onBusyChange(true); setError('');
    try { setResult(await api.changeFortniteSettings(review.token)); accept(await api.getFortniteSettings()); }
    catch (e) { setError(errorMessage(e)); }
    finally { setReview(null); pending.current = false; setBusy(false); onBusyChange(false); }
  };
  if (restoreOnly && !info?.managed && !error) return null;
  const disabled = !isDesktop || reading || busy || !info?.canChange;
  const editingDisabled = disabled || Boolean(info?.managed);
  const changed = draft && info?.current && (Object.keys(draft) as (keyof FortniteValues)[]).some(key => draft[key] !== info.current![key]);
  return <section className="panel fortnite-settings" aria-label="Fortnite display preferences">
    <PanelTitle icon={Gamepad2} title="Fortnite display preferences" action={<Badge tone={info?.conflict ? 'amber' : 'purple'}>{info?.conflict ? 'EXTERNAL CHANGE' : info?.managed ? 'ORIGINAL SAVED' : 'OPTIONAL'}</Badge>}/>
    <p className="benchmark-note">Set a frame cap, V-Sync and dynamic resolution in Fortnite’s existing local configuration. Close Fortnite and configuration editors first. Check the video menu on your next launch; a game update or cloud sync may replace these values.</p>
    {!isDesktop && <Notice>Open the Windows app to read your Fortnite settings.</Notice>}
    {info?.reason && <Notice tone="warning">{info.reason}</Notice>}
    {info?.current && <div className="fortnite-settings-grid">
      <div className="fortnite-setting"><h3>Frame rate limit</h3><p>A cap can reduce GPU load and make frame delivery steadier. A lower cap may increase latency; unlimited can use more power. Choose a cap your PC can sustain.</p><span className="accounting-note">Current file: {capLabel(info.current.frameRateLimit)}</span><label>Frame rate limit<select disabled={editingDisabled || restoreOnly} value={draft?.frameRateLimit ?? info.current.frameRateLimit} onChange={e => setDraft(v => v && ({ ...v, frameRateLimit: Number(e.target.value) }))}>{![...FORTNITE_FRAME_CAPS].some(v => v === info.current!.frameRateLimit) && <option value={info.current.frameRateLimit}>{capLabel(info.current.frameRateLimit)} (current)</option>}{FORTNITE_FRAME_CAPS.map(cap => <option value={cap} key={cap}>{capLabel(cap)}</option>)}</select></label></div>
      <div className="fortnite-setting"><h3>V-Sync</h3><p>Can reduce tearing by synchronizing frames with the display. It can add latency. Coordinate this with your driver and variable-refresh settings; there is no universal best choice.</p><span className="accounting-note">Current file: {info.current.vsync ? 'On' : 'Off'}</span><label>V-Sync<select disabled={editingDisabled || restoreOnly} value={String(draft?.vsync ?? info.current.vsync)} onChange={e => setDraft(v => v && ({ ...v, vsync: e.target.value === 'true' }))}><option value="false">Off</option><option value="true">On</option></select></label></div>
      <div className="fortnite-setting"><h3>Dynamic resolution</h3><p>Allows supported rendering modes to vary internal resolution to meet their frame target. Image sharpness can change. Turning it off keeps resolution steadier but can reduce performance.</p><span className="accounting-note">Current file: {info.current.dynamicResolution ? 'On' : 'Off'}</span><label>Dynamic resolution<select disabled={editingDisabled || restoreOnly} value={String(draft?.dynamicResolution ?? info.current.dynamicResolution)} onChange={e => setDraft(v => v && ({ ...v, dynamicResolution: e.target.value === 'true' }))}><option value="false">Off</option><option value="true">On</option></select></label></div>
    </div>}
    {info?.managed && <p className="accounting-note">Managed settings: {info.managedFields.map(key => FORTNITE_LABELS[key]).join(', ')}. Restore the saved display values before applying another configuration. Unrelated newer settings are preserved; conflicting managed values block restoration.</p>}
    <div className="button-row"><button className="button secondary" disabled={!isDesktop || reading || busy} onClick={() => void load()}><RefreshCw size={14}/>{reading ? 'Reading settings…' : 'Read Fortnite settings'}</button>{!restoreOnly && <button className="button primary" disabled={editingDisabled || !changed} onClick={() => void preview(false)}>Review Fortnite changes</button>}<button className="button secondary" disabled={disabled || !info?.managed} onClick={() => void preview(true)}>Review original configuration</button></div>
    {error && <Notice tone="error">{error}</Notice>}{result && <Notice tone={result.success ? 'success' : 'warning'}>{result.message}</Notice>}
    {review && <Modal title={review.restore ? 'Restore original Fortnite display values?' : 'Apply Fortnite display preferences?'} description="Keep Fortnite and configuration editors closed until this operation finishes. Only the reviewed local configuration is changed; game executables, anti-cheat and driver settings are untouched." onClose={() => setReview(null)} busy={busy} footer={<><button className="button secondary" disabled={busy} onClick={() => setReview(null)}>Cancel</button><button className="button primary" disabled={busy} onClick={() => void apply()}>{busy ? <Spinner label="Verifying configuration…"/> : review.restore ? 'Restore Fortnite configuration' : 'Apply Fortnite preferences'}</button></>}>
      <dl className="detail-list"><div><dt>Frame cap</dt><dd>{capLabel(review.current.frameRateLimit)} → {capLabel(review.desired.frameRateLimit)}</dd></div><div><dt>V-Sync</dt><dd>{review.current.vsync ? 'On' : 'Off'} → {review.desired.vsync ? 'On' : 'Off'}</dd></div><div><dt>Dynamic resolution</dt><dd>{review.current.dynamicResolution ? 'On' : 'Off'} → {review.desired.dynamicResolution ? 'On' : 'Off'}</dd></div></dl>
      <Notice>{review.restore ? 'Restores only the values PANDORA changed. Other settings and newer formatting are preserved. A conflicting managed value blocks restoration; values already back at their originals need no write.' : 'The entire original configuration is stored in your local PANDORA backup. Only changed values in these three existing keys are replaced. Formatting, other settings and file encoding are preserved. No read-only flag is added.'}</Notice>
      <p className="accounting-note">These are saved preferences, not live game readings. Confirm compatibility and actual performance in Fortnite. No FPS or input-latency improvement has been measured.</p>
    </Modal>}
  </section>;
}
