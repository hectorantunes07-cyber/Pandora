import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, CheckCircle2, ChevronRight, CircleAlert, FileCheck2, Gamepad2, History, Info, ListFilter, RefreshCw, RotateCcw, Search, ShieldCheck, SlidersHorizontal, Sparkles, X, Zap } from 'lucide-react';
import type { GameInfo, HistoryEntry, OperationResult, TweakState } from '../shared/types';
import { StartupControls } from './StartupControls';
import { GAME_GUIDES, findInstalledGame } from '../shared/game-guides';
import { PowerControls } from './PowerControls';
import { ProfileControls } from './ProfileControls';
import { TWEAK_CATALOG } from '../electron/tweak-catalog';
import { api, errorMessage, formatDate, isDesktop, unsupportedMessage } from './api';
import { Badge, Checkbox, EmptyState, IconBox, Modal, Notice, PageHeading, PanelTitle, Spinner } from './components';

const unavailableTweaks: TweakState[] = TWEAK_CATALOG.map(tweak => ({ ...tweak, state: 'unsupported', currentValue: null, managed: false, reason: unsupportedMessage }));
const stateLabels: Record<TweakState['state'], string> = { available: 'Ready to review', applied: 'Applied by Pandora', 'already-set': 'Already configured', unsupported: 'Windows app required', unknown: 'Status unavailable', conflict: 'Needs your review' };
export function Optimizations({ tweaks, refresh, notify, quickReview, onQuickReviewed, onBusyChange }: { tweaks: TweakState[]; refresh: () => Promise<void>; notify: (message: string) => void; quickReview: boolean; onQuickReviewed: () => void; onBusyChange: (busy: boolean) => void }) {
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
  return <><PageHeading eyebrow="THOUGHTFUL CHANGES, REAL CONTROL" title="Optimizations" description="Understand the change. Weigh the tradeoff. Keep a way back."><button className="button secondary compact" onClick={() => void refresh()} disabled={!isDesktop || busy}><RefreshCw size={15}/>Refresh status</button></PageHeading>
  <section className="optimization-intro"><div><IconBox icon={ShieldCheck}/><div><h3>A saved original. Every time.</h3><p>PANDORA snapshots each managed setting before changing it. Restore individual changes from your history.</p></div></div><Badge tone="green">REVERSIBLE SETTINGS</Badge></section>
  {error && <Notice tone={isDesktop ? 'warning' : 'info'}>{error}</Notice>}
  {results.length > 0 && <section className="panel operation-results"><PanelTitle icon={FileCheck2} title="Operation results" action={<button className="icon-button" aria-label="Dismiss operation results" onClick={() => setResults([])}><X size={15}/></button>}/>{results.map(result => <div className={`operation-result ${result.success ? 'success' : 'warning'}`} key={result.id}>{result.success ? <CheckCircle2 size={17}/> : <CircleAlert size={17}/>}<div><strong>{available.find(tweak => tweak.id === result.id)?.title || result.id}</strong><p>{result.message}</p></div></div>)}</section>}
  <PowerControls onBusyChange={onBusyChange}/>
  <div className="filter-toolbar"><div className="tabs" role="tablist" aria-label="Optimization categories">{['All', 'Gaming', 'Privacy', 'Quality of life'].map(item => <button className={`tab ${category === item ? 'active' : ''}`} role="tab" aria-selected={category === item} key={item} onClick={() => setCategory(item)}>{item}{item === 'All' && <span>{available.length}</span>}</button>)}</div><label className="search-field"><Search size={16}/><input placeholder="Search optimizations…" aria-label="Search optimizations" value={query} onChange={event => setQuery(event.target.value)}/>{query && <button className="icon-button" aria-label="Clear search" onClick={() => setQuery('')}><X size={13}/></button>}</label></div>
  <div className="optimization-meta"><span>{visible.length} {visible.length === 1 ? 'preference' : 'preferences'}<span className="footer-dot">·</span>No promised FPS gains</span><span><ShieldCheck size={13}/> Security protections stay on</span></div>
  <div className="tweak-grid">{visible.map(tweak => <article className={`tweak-card ${selected.includes(tweak.id) ? 'selected' : ''}`} key={tweak.id}><div className="tweak-top"><span className="tweak-category"><span className={`category-dot ${tweak.category.toLowerCase().replaceAll(' ', '-')}`}/>{tweak.category}</span><Badge tone={tweak.risk === 'Low' ? 'green' : 'amber'}>{tweak.risk} risk</Badge></div><h3>{tweak.title}</h3><p>{tweak.description}</p><button className="text-button tweak-detail" onClick={() => setDetail(tweak)}>What changes?<ArrowUpRight size={13}/></button><div className="tweak-bottom"><span className={`tweak-state ${tweak.state === 'applied' || tweak.state === 'already-set' ? 'good' : ''}`}>{tweak.state === 'applied' || tweak.state === 'already-set' ? <CheckCircle2 size={14}/> : <span className="tiny-dot"/>}{isDesktop && tweak.state === 'unsupported' ? 'Unsupported on this PC' : stateLabels[tweak.state]}</span>{tweak.state === 'applied' || tweak.managed ? <button className="icon-button" aria-label={`Restore ${tweak.title}`} disabled={busy} onClick={() => review([tweak.id], 'revert')}><RotateCcw size={16}/></button> : <Checkbox label={`Select ${tweak.title}`} checked={selected.includes(tweak.id)} disabled={tweak.state !== 'available' || busy} onChange={() => setSelected(previous => previous.includes(tweak.id) ? previous.filter(id => id !== tweak.id) : [...previous, tweak.id])}/>}</div></article>)}</div>
  {visible.length === 0 && <EmptyState icon={Search} title={query ? 'No matching preferences' : 'No preferences available'} description={query ? 'Try a different search or category.' : 'Refresh the status to detect supported preferences on your PC.'}>{isDesktop && <button className="button secondary" onClick={() => void refresh()}>Refresh status</button>}</EmptyState>}
  {selected.length > 0 && <div className="sticky-selection"><div><span className="selection-count">{selected.length}</span><strong>{selected.length === 1 ? 'Preference' : 'Preferences'} selected</strong><button className="text-button" onClick={() => setSelected([])} disabled={busy}>Clear</button></div><button className="button primary" disabled={busy} onClick={() => review(selected.filter(id => available.some(tweak => tweak.id === id && tweak.state === 'available')), 'apply')}><ShieldCheck size={16}/>Review changes<ArrowRight size={15}/></button></div>}
  <Notice>These are focused Windows preferences, not a blanket “boost.” PANDORA does not disable Defender, Windows Update, anti-cheat, system services, or memory protections.</Notice>
  {detail && <Modal title={detail.title} description={detail.description} onClose={() => setDetail(null)} footer={<><button className="button secondary" onClick={() => setDetail(null)}>Close</button>{detail.managed ? <button className="button primary" onClick={() => review([detail.id], 'revert')}><RotateCcw size={15}/>Review restore</button> : <button className="button primary" disabled={detail.state !== 'available'} onClick={() => review([detail.id], 'apply')}>Review change<ArrowRight size={15}/></button>}</>}><dl className="detail-list"><div><dt>Tradeoff</dt><dd>{detail.tradeoff}</dd></div><div><dt>After applying</dt><dd>{detail.restart}</dd></div><div><dt>Current value</dt><dd>{detail.state === 'unknown' || detail.state === 'unsupported' ? 'Unavailable' : detail.currentValue == null ? 'Not explicitly set' : detail.currentValue}</dd></div><div><dt>Proposed value</dt><dd>{detail.desiredValue}</dd></div><div><dt>Exact setting</dt><dd><code>{detail.target}</code></dd></div></dl>{detail.reason && <Notice>{detail.reason}</Notice>}<a className="text-button" href={detail.reference} target="_blank" rel="noreferrer">Microsoft documentation<ArrowUpRight size={14}/></a></Modal>}
  {confirmation && <Modal title={confirmation.action === 'revert' ? 'Restore your original settings?' : confirmation.quick ? 'Your Quick Optimize review' : 'Review your changes'} description={confirmation.action === 'revert' ? 'PANDORA will restore the exact original values saved before your changes. Settings changed by another app will be reported as conflicts.' : 'Nothing changes until you confirm. The original value of each setting is saved locally first.'} busy={busy} onClose={() => setConfirmation(null)} footer={<><button className="button secondary" disabled={busy} onClick={() => setConfirmation(null)}>Cancel</button><button className="button primary" disabled={busy || confirmation.ids.length === 0} onClick={run}>{busy ? <Spinner label={confirmation.action === 'apply' ? 'Applying changes…' : 'Restoring settings…'}/> : <><ShieldCheck size={15}/>{confirmation.action === 'apply' ? 'Confirm & apply' : 'Confirm restore'}</>}</button></>}><div className="change-preview">{confirmation.ids.map(id => { const tweak = available.find(item => item.id === id); if (!tweak) return null; return <div key={id}><div className="change-title"><Check size={15}/><h3>{tweak.title}</h3><Badge tone="green">{tweak.risk} risk</Badge></div><p>{confirmation.action === 'apply' ? tweak.tradeoff : 'Restore the value or remove the value if it did not exist before PANDORA.'}</p><span className="restart-note">{tweak.restart}</span><details><summary>Exact setting</summary><code>{tweak.target}</code>{confirmation.action === 'apply' && <span>{tweak.currentValue ?? 'Not set'} → {tweak.desiredValue}</span>}</details></div>; })}</div>{confirmation.quick && <Notice>Quick Optimize starts with Windows Game Mode only. Recording, privacy, and visual preferences remain individual choices. Performance improvements are not guaranteed.</Notice>}</Modal>}</>;
}

export function Restore({ tweaks, notify, refreshTweaks, onBusyChange }: { tweaks: TweakState[]; notify: (message: string) => void; refreshTweaks: () => Promise<void>; onBusyChange: (busy: boolean) => void }) {
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
  const exportHistory = async () => {
    try { const path = await api.exportReport('history'); if (path) notify(`History report saved to ${path}`); }
    catch (err) { setError(errorMessage(err)); }
  };
  return <>
    <PageHeading eyebrow="CONFIDENCE COMES WITH A WAY BACK" title="Restore & History" description="Your original settings and a clear record of every managed change.">
      <button className="button secondary" disabled={loading || busy || !isDesktop} onClick={() => void load()}><RefreshCw size={15} className={loading ? 'spin' : ''}/>Refresh</button>
      <button className="button secondary" disabled={busy || !isDesktop} onClick={exportHistory}><History size={15}/>Export history</button>
      <button className="button primary" disabled={loading || busy || !current.length} onClick={() => review(current)}><RotateCcw size={15}/>Restore all preferences</button>
    </PageHeading>
    <ProfileControls tweaks={tweaks} refreshTweaks={refreshTweaks} onBusyChange={onBusyChange} restoreOnly/>
    <PowerControls onBusyChange={onBusyChange} restoreOnly/>
    <StartupControls onBusyChange={onBusyChange} restoreOnly/>
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
  const gameOptions = GAME_GUIDES;
  const chosen = gameOptions.find(item => item.id === game)!;
  const detected = findInstalledGame(game, games);
  return <><PageHeading eyebrow="READY FOR YOUR NEXT SESSION" title="Game Profiles" description="Reviewed presets, saved originals and practical guidance for your games."/><ProfileControls tweaks={tweaks} refreshTweaks={refreshTweaks} onBusyChange={onBusyChange}/><div className="game-cards">{gameOptions.map(item => <button className={`game-card ${item.id === game ? 'active' : ''} game-${item.id}`} key={item.id} onClick={() => setGame(item.id)}><div className="game-art" aria-hidden="true"><span>{item.initials}</span><i/><i/><i/></div><div className="game-card-copy"><h3>{item.name}</h3><span>{Boolean(findInstalledGame(item.id, games)) ? 'Detected on this PC' : isDesktop ? 'Not detected' : 'Windows app required'}</span><ChevronRight size={18}/></div></button>)}<div className="game-card planned-game" aria-label="GTA VI planned, unavailable"><div className="game-art" aria-hidden="true"><span>VI</span></div><div className="game-card-copy"><h3>Grand Theft Auto VI</h3><span>Planned · no verified PC profile</span></div></div></div><section className="panel game-profile"><PanelTitle icon={Gamepad2} title={`${chosen.name} · Session checklist`} action={<Badge tone="purple">REVIEW FIRST</Badge>}/><div className="game-profile-intro"><div><span className="eyebrow">{chosen.genre}</span><h3>Make a considered start.</h3><p>Use Windows Game Mode, review capture overhead, then measure under repeatable conditions. These preferences are system-wide for your user account; they do not edit game files.</p>{detected?.path && <span className="game-path">Detected installation: <code>{detected.path}</code></span>}</div><button className="button primary" onClick={review}><ShieldCheck size={16}/>Review Game Mode<ArrowRight size={15}/></button></div><Notice>{chosen.guidance}</Notice><div className="game-checklist">{[{ title: 'Review Windows Game Mode', description: 'Review the actual Game Mode preference before applying. Your original setting is backed up.', note: tweaks.find(tweak => tweak.id === 'game-mode')?.state === 'applied' ? 'Managed by Pandora' : 'Optional Windows preference' }, { title: 'Keep recording if you use it', description: 'The separate “Turn off Windows game capture” preference is available in Optimizations. Leave it alone if you record clips.', note: 'Choose deliberately' }, { title: 'Match settings to your hardware', description: 'Review your in-game display mode, resolution, and frame cap. PANDORA never injects into games or changes anti-cheat.', note: 'In-game settings' }, { title: 'Measure before and after', description: 'Keep the same scene, graphics settings, resolution, and test duration. Record measured FPS and latency in Performance Lab.', note: 'No estimated gains' }].map((item, i) => <div className="checklist-row" key={item.title}><span>{String(i + 1).padStart(2, '0')}</span><div><h3>{item.title}</h3><p>{item.description}</p></div><Badge>{item.note}</Badge></div>)}</div></section><Notice>Game detection checks supported installation locations and launcher metadata; a custom installation may not be detected. Profiles do not promise a particular FPS, latency, or competitive advantage.</Notice></>;
}
