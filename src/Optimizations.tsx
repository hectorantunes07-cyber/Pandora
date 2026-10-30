import { PowerTuning } from './PowerTuning';
import { SystemRestore } from './SystemRestore';
import { CursorCustomization } from './CursorCustomization';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, CheckCircle2, ChevronRight, CircleAlert, FileCheck2, Gamepad2, History, Info, ListFilter, RefreshCw, RotateCcw, Search, ShieldCheck, SlidersHorizontal, Sparkles, X, Zap } from 'lucide-react';
import type { GameInfo, HistoryEntry, ManualGamePath, OperationResult, SystemInfo, TweakState } from '../shared/types';
import { GraphicsGuidance } from './GraphicsGuidance';
import { VisualEffects } from './VisualEffects';
import { StartupControls } from './StartupControls';
import { RestoreAll } from './RestoreAll';
import { PointerControls } from './PointerControls';
import { GAME_GUIDES, findInstalledGame } from '../shared/game-guides';
import { PowerControls } from './PowerControls';
import { ProfileControls } from './ProfileControls';
import { TWEAK_CATALOG } from '../electron/tweak-catalog';
import { api, errorMessage, formatDate, isDesktop, unsupportedMessage } from './api';
import { Badge, Checkbox, EmptyState, IconBox, Modal, Notice, PageHeading, PanelTitle, Spinner } from './components';

const unavailableTweaks: TweakState[] = TWEAK_CATALOG.map(tweak => ({ ...tweak, state: 'unsupported', currentValue: null, managed: false, reason: unsupportedMessage }));
const stateLabels: Record<TweakState['state'], string> = { available: 'Ready to review', applied: 'Applied by Pandora', 'already-set': 'Already configured', unsupported: 'Windows app required', unknown: 'Status unavailable', conflict: 'Needs your review' };
export function Optimizations({ system, tweaks, refresh, notify, quickReview, onQuickReviewed, onBusyChange }: { system: SystemInfo | null; tweaks: TweakState[]; refresh: () => Promise<void>; notify: (message: string) => void; quickReview: boolean; onQuickReviewed: () => void; onBusyChange: (busy: boolean) => void }) {
  const [category, setCategory] = useState('All');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<TweakState | null>(null);
  const [confirmation, setConfirmation] = useState<{ ids: string[]; action: 'apply' | 'revert'; quick?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<OperationResult[]>([]);
  const available = isDesktop ? tweaks : unavailableTweaks;
  const visible = available.filter(tweak => (category === 'All' || tweak.category === category) && `${tweak.title} ${tweak.description}`.toLowerCase().includes(query.toLowerCase()));
  const quickIds = available.filter(tweak => tweak.id === 'game-mode' && tweak.state === 'available').map(tweak => tweak.id);
  useEffect(() => {
    if (!quickReview) return;
    if (quickIds.length) { setSelected(quickIds); setConfirmation({ ids: quickIds, action: 'apply', quick: true }); }
    else { setCategory('Gaming'); setError(isDesktop ? 'No Quick Optimize changes are currently available. Review your current gaming preferences below.' : 'Quick Optimize is ready to review in the Windows app. No settings have been changed.'); }
    onQuickReviewed();
  }, [quickReview]);
  const run = async () => {
    if (!confirmation || busy) return;
    setBusy(true); onBusyChange(true); setError(''); setResults([]);
    try {
      const next = await (confirmation.action === 'apply' ? api.applyTweaks(confirmation.ids) : api.revertTweaks(confirmation.ids));
      setResults(next); setConfirmation(null); setDetail(null); setSelected([]);
      notify(`${next.filter(item => item.success).length} of ${next.length} ${confirmation.action === 'apply' ? 'changes' : 'restorations'} completed. Review the result details below.`);
      await refresh();
    } catch (err) { setError(errorMessage(err)); setConfirmation(null); }
    finally { setBusy(false); onBusyChange(false); }
  };
  const review = (ids: string[], action: 'apply' | 'revert') => { setDetail(null); setConfirmation({ ids, action }); setError(''); };
  return <><PageHeading eyebrow="WINDOWS SETTINGS" title="Optimizations" description="Review, apply, and restore supported Windows settings."><button className="button secondary compact" onClick={() => void refresh()} disabled={!isDesktop || busy}><RefreshCw size={15}/>Refresh status</button></PageHeading>
  <section className="optimization-intro"><div><IconBox icon={ShieldCheck}/><div><h3>Original settings saved before changes</h3><p>PANDORA snapshots each managed setting before changing it. Restore individual changes from your history.</p></div></div><Badge tone="green">REVERSIBLE SETTINGS</Badge></section>
  {error && <Notice tone={isDesktop ? 'warning' : 'info'}>{error}</Notice>}
  {results.length > 0 && <section className="panel operation-results"><PanelTitle icon={FileCheck2} title="Operation results" action={<button className="icon-button" aria-label="Dismiss operation results" onClick={() => setResults([])}><X size={15}/></button>}/>{results.map(result => <div className={`operation-result ${result.success ? 'success' : 'warning'}`} key={result.id}>{result.success ? <CheckCircle2 size={17}/> : <CircleAlert size={17}/>}<div><strong>{available.find(tweak => tweak.id === result.id)?.title || result.id}</strong><p>{result.message}</p></div></div>)}</section>}
  <div className="two-columns optimization-native-controls"><PowerControls onBusyChange={onBusyChange}/><PointerControls onBusyChange={onBusyChange}/></div>
  <div className="section-heading"><h2>Windows preferences</h2><span className="muted">Gaming, privacy, and File Explorer</span></div>
  <div className="filter-toolbar"><div className="tabs" role="tablist" aria-label="Optimization categories">{['All', 'Gaming', 'Privacy', 'Quality of life'].map(item => <button className={`tab ${category === item ? 'active' : ''}`} role="tab" aria-selected={category === item} key={item} onClick={() => setCategory(item)}>{item}{item === 'All' && <span>{available.length}</span>}</button>)}</div><label className="search-field"><Search size={16}/><input placeholder="Search optimizations…" aria-label="Search optimizations" value={query} onChange={event => setQuery(event.target.value)}/>{query && <button className="icon-button" aria-label="Clear search" onClick={() => setQuery('')}><X size={13}/></button>}</label></div>
  <div className="optimization-meta"><span>{visible.length} {visible.length === 1 ? 'preference' : 'preferences'}<span className="footer-dot">·</span>No promised FPS gains</span><span><ShieldCheck size={13}/> Security protections stay on</span></div>
  <div className="tweak-grid">{visible.map(tweak => <article className={`tweak-card ${selected.includes(tweak.id) ? 'selected' : ''}`} key={tweak.id}><div className="tweak-top"><span className="tweak-category"><span className={`category-dot ${tweak.category.toLowerCase().replaceAll(' ', '-')}`}/>{tweak.category}</span><Badge tone={tweak.risk === 'Low' ? 'green' : 'amber'}>{tweak.risk} risk</Badge></div><h3>{tweak.title}</h3><p>{tweak.description}</p><button className="text-button tweak-detail" onClick={() => setDetail(tweak)}>What changes?<ArrowUpRight size={13}/></button><div className="tweak-bottom"><span className={`tweak-state ${tweak.state === 'applied' || tweak.state === 'already-set' ? 'good' : ''}`}>{tweak.state === 'applied' || tweak.state === 'already-set' ? <CheckCircle2 size={14}/> : <span className="tiny-dot"/>}{isDesktop && tweak.state === 'unsupported' ? 'Unsupported on this PC' : stateLabels[tweak.state]}</span>{tweak.state === 'applied' || tweak.managed ? <button className="icon-button" aria-label={`Restore ${tweak.title}`} disabled={busy} onClick={() => review([tweak.id], 'revert')}><RotateCcw size={16}/></button> : <Checkbox label={`Select ${tweak.title}`} checked={selected.includes(tweak.id)} disabled={tweak.state !== 'available' || busy} onChange={() => setSelected(previous => previous.includes(tweak.id) ? previous.filter(id => id !== tweak.id) : [...previous, tweak.id])}/>}</div></article>)}</div>
  {visible.length === 0 && <EmptyState icon={Search} title={query ? 'No matching preferences' : 'No preferences available'} description={query ? 'Try a different search or category.' : 'Refresh the status to detect supported preferences on your PC.'}>{isDesktop && <button className="button secondary" onClick={() => void refresh()}>Refresh status</button>}</EmptyState>}
  {selected.length > 0 && <div className="sticky-selection"><div><span className="selection-count">{selected.length}</span><strong>{selected.length === 1 ? 'Preference' : 'Preferences'} selected</strong><button className="text-button" onClick={() => setSelected([])} disabled={busy}>Clear</button></div><button className="button primary" disabled={busy} onClick={() => review(selected.filter(id => available.some(tweak => tweak.id === id && tweak.state === 'available')), 'apply')}><ShieldCheck size={16}/>Review changes<ArrowRight size={15}/></button></div>}
  <GraphicsGuidance system={system} notify={notify}/>
  <PowerTuning onBusyChange={onBusyChange}/><VisualEffects onBusyChange={onBusyChange}/>
  <Notice>Defender, Windows Update, anti-cheat, and memory protections remain enabled.</Notice>
  {detail && <Modal title={detail.title} description={detail.description} onClose={() => setDetail(null)} footer={<><button className="button secondary" onClick={() => setDetail(null)}>Close</button>{detail.managed ? <button className="button primary" onClick={() => review([detail.id], 'revert')}><RotateCcw size={15}/>Review restore</button> : <button className="button primary" disabled={detail.state !== 'available'} onClick={() => review([detail.id], 'apply')}>Review change<ArrowRight size={15}/></button>}</>}><dl className="detail-list"><div><dt>Tradeoff</dt><dd>{detail.tradeoff}</dd></div><div><dt>After applying</dt><dd>{detail.restart}</dd></div><div><dt>Current value</dt><dd>{detail.state === 'unknown' || detail.state === 'unsupported' ? 'Unavailable' : detail.currentValue == null ? 'Not explicitly set' : detail.currentValue}</dd></div><div><dt>Proposed value</dt><dd>{detail.desiredValue}</dd></div><div><dt>Exact setting</dt><dd><code>{detail.target}</code></dd></div></dl>{detail.reason && <Notice>{detail.reason}</Notice>}<a className="text-button" href={detail.reference} target="_blank" rel="noreferrer">Microsoft documentation<ArrowUpRight size={14}/></a></Modal>}
  {confirmation && <Modal title={confirmation.action === 'revert' ? 'Restore your original settings?' : confirmation.quick ? 'Your Quick Optimize review' : 'Review your changes'} description={confirmation.action === 'revert' ? 'PANDORA will restore the exact original values saved before your changes. Settings changed by another app will be reported as conflicts.' : 'Nothing changes until you confirm. The original value of each setting is saved locally first.'} busy={busy} onClose={() => setConfirmation(null)} footer={<><button className="button secondary" disabled={busy} onClick={() => setConfirmation(null)}>Cancel</button><button className="button primary" disabled={busy || confirmation.ids.length === 0} onClick={run}>{busy ? <Spinner label={confirmation.action === 'apply' ? 'Applying changes…' : 'Restoring settings…'}/> : <><ShieldCheck size={15}/>{confirmation.action === 'apply' ? 'Confirm & apply' : 'Confirm restore'}</>}</button></>}><div className="change-preview">{confirmation.ids.map(id => { const tweak = available.find(item => item.id === id); if (!tweak) return null; return <div key={id}><div className="change-title"><Check size={15}/><h3>{tweak.title}</h3><Badge tone="green">{tweak.risk} risk</Badge></div><p>{confirmation.action === 'apply' ? tweak.tradeoff : 'Restore the value or remove the value if it did not exist before PANDORA.'}</p><span className="restart-note">{tweak.restart}</span><details><summary>Exact setting</summary><code>{tweak.target}</code>{confirmation.action === 'apply' && <span>{tweak.currentValue ?? 'Not set'} → {tweak.desiredValue}</span>}</details></div>; })}</div>{confirmation.quick && <Notice>Quick Optimize starts with Windows Game Mode only. Recording, privacy, and visual preferences remain individual choices. Performance improvements are not guaranteed.</Notice>}</Modal>}</>;
}

export function Restore({ tweaks, notify, refreshTweaks, onBusyChange }: { tweaks: TweakState[]; notify: (message: string) => void; refreshTweaks: () => Promise<void>; onBusyChange: (busy: boolean) => void }) {
  const [revision, setRevision] = useState(0);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selection, setSelection] = useState<HistoryEntry[] | null>(null);
  const [results, setResults] = useState<OperationResult[]>([]);
  const load = async () => {
    setLoading(true); setError('');
    try { setEntries(await api.getHistory()); }
    catch (err) { setError(errorMessage(err)); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (isDesktop) void load(); }, []);
  const current = entries.filter(entry => ['applied', 'conflict', 'pending'].includes(entry.status))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const review = (items: HistoryEntry[]) => { setSelection(items); setError(''); };
  const revert = async () => {
    if (!selection?.length || busy) return;
    setBusy(true); onBusyChange(true); setError(''); setResults([]);
    try {
      const next = await api.revertTweaks([...new Set(selection.map(entry => entry.tweakId))]);
      setResults(next); setSelection(null);
      await load(); await refreshTweaks();
      notify(`${next.filter(result => result.success).length} of ${next.length} restorations completed. Review each result below.`);
    } catch (err) { setError(errorMessage(err)); setSelection(null); }
    finally { setBusy(false); onBusyChange(false); }
  };
  const exporting = useRef(false);
  const exportHistory = async () => {
    if (exporting.current || busy) return;
    exporting.current = true; setBusy(true); onBusyChange(true); setError('');
    try { const path = await api.exportReport('history'); if (path) notify(`Managed settings report saved to ${path}`); }
    catch (err) { setError(errorMessage(err)); }
    finally {
      // State collection refreshes native review tokens. Reopen controls with fresh reviews.
      setRevision(n => n + 1); exporting.current = false; setBusy(false); onBusyChange(false);
    }
  };
  return <>
    <PageHeading eyebrow="BACKUP & RESTORE" title="Restore & History" description="Review your change history and restore saved settings.">
      <button className="button secondary" disabled={loading || busy || !isDesktop} onClick={() => void load()}><RefreshCw size={15} className={loading ? 'spin' : ''}/>Refresh</button>
      <button className="button secondary" disabled={busy || !isDesktop} onClick={exportHistory}><History size={15}/>Export managed report</button>
      <button className="button primary" disabled={loading || busy || !current.length} onClick={() => review(current)}><RotateCcw size={15}/>Restore all preferences</button>
    </PageHeading>
    <p className="accounting-note">The managed report includes preference history and current power, pointer, cursor, visual, startup and preset snapshots. Private paths and commands are excluded. It is a diagnostic report, not a restorable backup.</p>
    <SystemRestore onBusyChange={onBusyChange}/>
    <RestoreAll onBusyChange={onBusyChange} onRestored={async () => { await load(); await refreshTweaks(); setRevision(n => n + 1); }}/>
    <ProfileControls key={`profile-${revision}`} tweaks={tweaks} refreshTweaks={refreshTweaks} onBusyChange={onBusyChange} restoreOnly/>
    <PowerControls key={`power-${revision}`} onBusyChange={onBusyChange} restoreOnly/>
    <PowerTuning key={`power-tuning-${revision}`} onBusyChange={onBusyChange} restoreOnly/><PointerControls key={`pointer-${revision}`} onBusyChange={onBusyChange} restoreOnly/><CursorCustomization key={`cursor-${revision}`} onBusyChange={onBusyChange} restoreOnly/>
    <VisualEffects key={`visual-${revision}`} onBusyChange={onBusyChange} restoreOnly/>
    <StartupControls key={`startup-${revision}`} onBusyChange={onBusyChange} restoreOnly/>
    <Notice>These are setting snapshots created by PANDORA, not Windows System Restore points. Restore changes only the reviewed managed preferences. Deleted cleanup files cannot be restored here.</Notice>
    {error && <Notice tone="error">{error}</Notice>}
    {results.length > 0 && <section className="panel operation-results" aria-label="Restoration results">
      <PanelTitle icon={FileCheck2} title="Restoration results" action={<button className="icon-button" aria-label="Dismiss restoration results" onClick={() => setResults([])}><X size={15}/></button>}/>
      {results.map(result => <div className={`operation-result ${result.success ? 'success' : 'warning'}`} key={result.id}>
        {result.success ? <CheckCircle2 size={17}/> : <CircleAlert size={17}/>}
        <div><strong>{entries.find(entry => entry.tweakId === result.id)?.title || result.id}</strong><p>{result.message}</p></div>
      </div>)}
    </section>}
    <div className="history-summary"><IconBox icon={History}/><div><strong>{isDesktop ? current.length : '—'}</strong><span>managed settings with saved originals</span></div><div><ShieldCheck size={17}/><span>Saved locally on this PC</span></div></div>
    <section className="panel">
      <PanelTitle icon={History} title="Change history" action={<Badge>{entries.length} RECORDS</Badge>}/>
      {loading ? <div className="panel-loading"><Spinner label="Reading your history…"/></div> : entries.length ? <div className="history-list">
        {[...entries].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).map(entry => <div className="history-row" key={entry.id}>
          <div className={`history-status-icon ${entry.status}`}><History size={18}/></div>
          <div className="history-copy"><div><h3>{entry.title}</h3><Badge tone={entry.status === 'applied' ? 'purple' : entry.status === 'reverted' ? 'green' : 'amber'}>{entry.status}</Badge></div><p>{entry.message}</p><span>{formatDate(entry.timestamp)} <span className="footer-dot">·</span> Original: {entry.originalValue ?? 'not set'} → Applied: {entry.appliedValue}</span></div>
          {current.includes(entry) && <button className="button secondary compact" onClick={() => review([entry])} disabled={busy}><RotateCcw size={14}/>Restore</button>}
        </div>)}
      </div> : <EmptyState icon={History} title={isDesktop ? 'Your history starts with your first change' : 'Your history belongs to your PC'} description={isDesktop ? 'When you apply a preference, its original setting and operation result will appear here.' : 'Open the Windows app to view locally saved changes and restore your original settings.'}/>}
    </section>
    {selection && <Modal title={selection.length === 1 ? `Restore ${selection[0].title}?` : `Restore ${selection.length} managed settings?`} description="Review your saved originals. Each setting is checked before restoration; an external change is preserved and reported as a conflict." onClose={() => setSelection(null)} busy={busy} footer={<>
      <button className="button secondary" disabled={busy} onClick={() => setSelection(null)}>Cancel</button>
      <button className="button primary" disabled={busy} onClick={revert}>{busy ? <Spinner label="Restoring…"/> : <><RotateCcw size={15}/>Confirm restore</>}</button>
    </>}>
      {selection.map(entry => <section className="restore-preview" key={entry.id}><h3>{entry.title}</h3><dl className="detail-list"><div><dt>Original value</dt><dd>{entry.originalValue ?? 'Not set (remove the added value)'}</dd></div><div><dt>PANDORA value</dt><dd>{entry.appliedValue}</dd></div><div><dt>Saved on</dt><dd>{formatDate(entry.timestamp)}</dd></div></dl></section>)}
      <Notice>Settings are restored from newest to oldest. A conflict on one preference does not overwrite external changes or hide other results. You may need to reopen the affected app or sign out for the change to appear.</Notice>
    </Modal>}
  </>;
}

export function GameProfiles({ games, tweaks, review, refreshTweaks, onBusyChange }: { refreshTweaks: () => Promise<void>; onBusyChange: (busy: boolean) => void; games: GameInfo[]; tweaks: TweakState[]; review: () => void }) {
  const [game, setGame] = useState('fortnite');
  const [manualGames, setManualGames] = useState<ManualGamePath[]>([]);
  const [pathError, setPathError] = useState(''), [pathBusy, setPathBusy] = useState(false);
  useEffect(() => { if (isDesktop) void api.getManualGames().then(setManualGames).catch(err => setPathError(errorMessage(err))); }, []);
  const selectedManual = manualGames.find(item => item.id === game);
  const choosePath = async (clear = false) => {
    if (pathBusy) return;
    setPathBusy(true); onBusyChange(true); setPathError('');
    try {
      if (clear) await api.clearGameExecutable(game);
      else await api.selectGameExecutable(game);
      setManualGames(await api.getManualGames());
    } catch (err) { setPathError(errorMessage(err)); }
    finally { setPathBusy(false); onBusyChange(false); }
  };
  const gameOptions = GAME_GUIDES;
  const chosen = gameOptions.find(item => item.id === game)!;
  const detected = findInstalledGame(game, games);
  return <><PageHeading eyebrow="GAME SETTINGS" title="Game Profiles" description="Windows presets, game locations, and configuration guides."/><ProfileControls tweaks={tweaks} refreshTweaks={refreshTweaks} onBusyChange={onBusyChange}/><div className="game-cards">{gameOptions.map(item => <button className={`game-card ${item.id === game ? 'active' : ''} game-${item.id}`} key={item.id} onClick={() => setGame(item.id)}><div className="game-art" aria-hidden="true"><span>{item.initials}</span><i/><i/><i/></div><div className="game-card-copy"><h3>{item.name}</h3><span>{manualGames.some(m => m.id === item.id) ? manualGames.find(m => m.id === item.id)?.available ? 'Manual path' : 'Manual path unavailable' : Boolean(findInstalledGame(item.id, games)) ? 'Detected on this PC' : isDesktop ? 'Not detected' : 'Windows app required'}</span><ChevronRight size={18}/></div></button>)}</div><section className="panel manual-game-location"><PanelTitle icon={Gamepad2} title={`${chosen.name} · Game location`} action={<Badge tone={selectedManual?.available || detected ? 'green' : 'amber'}>{selectedManual ? selectedManual.available ? 'MANUAL PATH' : 'PATH UNAVAILABLE' : detected ? 'AUTO-DETECTED' : 'NOT DETECTED'}</Badge>}/><p className="benchmark-note">Choose the actual game .exe if your custom install was not detected. A manual path is your selection, not verified game identity. PANDORA stores the location locally and never launches, injects into, or edits the executable.</p>{(selectedManual || detected?.path) && <p className="game-path"><code>{selectedManual?.executable ?? detected?.path}</code></p>}{selectedManual && !selectedManual.available && <Notice tone="warning">The saved executable is missing, unreadable, or no longer a Windows executable. Choose its new location or forget this saved path.</Notice>}{pathError && <Notice tone="error">{pathError}</Notice>}<div className="button-row"><button className="button secondary" disabled={!isDesktop || pathBusy} onClick={() => void choosePath()}>{pathBusy ? <Spinner label="Checking game location…"/> : selectedManual ? 'Change executable' : 'Choose executable'}</button>{selectedManual && <button className="button secondary" disabled={pathBusy} onClick={() => void choosePath(true)}>Forget saved path</button>}</div></section><section className="panel game-profile"><PanelTitle icon={Gamepad2} title={`${chosen.name} · Session checklist`} action={<Badge tone="purple">REVIEW FIRST</Badge>}/><div className="game-profile-intro"><div><span className="eyebrow">{chosen.genre}</span><h3>Review your gaming setup</h3><p>Use Windows Game Mode, review capture overhead, then measure under repeatable conditions. These preferences are system-wide for your user account; they do not edit game files.</p>{detected?.path && <span className="game-path">Detected installation: <code>{detected.path}</code></span>}</div><button className="button primary" onClick={review}><ShieldCheck size={16}/>Review Game Mode<ArrowRight size={15}/></button></div><Notice>{chosen.guidance}</Notice><div className="game-checklist">{[{ title: 'Review Windows Game Mode', description: 'Review the actual Game Mode preference before applying. Your original setting is backed up.', note: tweaks.find(tweak => tweak.id === 'game-mode')?.state === 'applied' ? 'Managed by Pandora' : 'Optional Windows preference' }, { title: 'Keep recording if you use it', description: 'The separate “Turn off Windows game capture” preference is available in Optimizations. Leave it alone if you record clips.', note: 'Recording preference' }, { title: 'Match settings to your hardware', description: 'Review your in-game display mode, resolution, and frame cap. PANDORA never injects into games or changes anti-cheat.', note: 'In-game settings' }, { title: 'Measure before and after', description: 'Keep the same scene, graphics settings, resolution, and test duration. Record measured FPS and latency in Performance Lab.', note: 'No estimated gains' }].map((item, i) => <div className="checklist-row" key={item.title}><span>{String(i + 1).padStart(2, '0')}</span><div><h3>{item.title}</h3><p>{item.description}</p></div><Badge>{item.note}</Badge></div>)}</div></section><Notice>Game detection checks supported installation locations and launcher metadata; a custom installation may not be detected. Profiles do not promise a particular FPS, latency, or competitive advantage.</Notice></>;
}
