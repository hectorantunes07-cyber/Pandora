import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Activity, ArrowDown, ArrowRight, ArrowUp, ChartNoAxesCombined, Check, Download, FlaskConical, Layers, Monitor, RefreshCw, Save, Search, Settings, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import type { AppSettings, ProcessInfo, StartupEntry } from '../shared/types';
import { api, errorMessage, formatBytes, isDesktop, unsupportedMessage } from './api';
import { ProcessDetails } from './ProcessDetails';
import { OptionalApps } from './OptionalApps';
import { StartupControls } from './StartupControls';
import { AppLifecycleSettings } from './AppLifecycleSettings';
import { BenchmarkConfiguration } from './BenchmarkConfiguration';
import { contextDifferences, contextRows, validBenchmarkContext, type BenchmarkContext } from '../shared/benchmark-context';
import { FrameImport, CaptureSummary } from './FrameImport';
import { validFrameCapture, type FrameCapture } from '../shared/frame-capture';
import { Badge, EmptyState, Modal, Notice, PageHeading, PanelTitle, Spinner, Toggle } from './components';

export function Processes({ onBusyChange }: { onBusyChange: (busy: boolean) => void }) {
  const [tab, setTab] = useState<'processes' | 'startup' | 'optional'>('processes');
  const [detailsPid, setDetailsPid] = useState<number | null>(null);
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [startup, setStartup] = useState<StartupEntry[]>([]);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'memory' | 'name' | 'cpu'>('memory');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [updated, setUpdated] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    if (!isDesktop || tab === 'optional') return;
    setLoading(true); setError('');
    try {
      if (tab === 'processes') setProcesses(await api.getProcesses());
      else setStartup(await api.getStartup());
      setUpdated(new Date().toLocaleTimeString());
    } catch (err) { setError(errorMessage(err)); }
    finally { setLoading(false); }
  }, [tab]);
  useEffect(() => { setUpdated(null); void refresh(); }, [refresh]);
  const filteredProcesses = useMemo(() => processes.filter(process => `${process.name} ${process.pid}`.toLowerCase().includes(search.trim().toLowerCase())).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'cpu' ? (b.cpuSeconds ?? -1) - (a.cpuSeconds ?? -1) : b.memoryBytes - a.memoryBytes), [processes, search, sort]);
  const filteredStartup = useMemo(() => startup.filter(entry => `${entry.name} ${entry.location} ${entry.status}`.toLowerCase().includes(search.trim().toLowerCase())), [startup, search]);
  const count = tab === 'processes' ? filteredProcesses.length : filteredStartup.length;

  return <>
    <PageHeading eyebrow="APPLICATIONS" title="Processes & Startup" description="Review running processes, startup entries, and optional Windows apps.">
      {tab === 'startup' && <button className="button primary" disabled={!isDesktop} onClick={() => api.openWindowsSettings('startup').catch(err => setError(errorMessage(err)))}>Open Windows startup settings<ArrowRight size={16}/></button>}
      {tab !== 'optional' && <button className="button secondary" onClick={() => void refresh()} disabled={!isDesktop || loading}><RefreshCw size={16} className={loading ? 'spin' : ''}/>Refresh list</button>}
    </PageHeading>
    <div className="tabs" aria-label="Application inventory">
      <button className={`tab ${tab === 'processes' ? 'active' : ''}`} onClick={() => { setTab('processes'); setSearch(''); }}><Activity size={16}/>Running processes</button>
      <button className={`tab ${tab === 'startup' ? 'active' : ''}`} onClick={() => { setTab('startup'); setSearch(''); }}><Layers size={16}/>Startup apps</button>
      <button className={`tab ${tab === 'optional' ? 'active' : ''}`} onClick={() => setTab('optional')}><Layers size={16}/>Optional Windows apps</button>
    </div>
    {tab === 'optional' ? <OptionalApps/> : <>
    <Notice>{tab === 'processes' ? 'This view is read-only. Memory is each process’s working set; CPU time is its cumulative processor time, not a live percentage.' : 'The inventory below is read-only. Manage supported launcher entries with the reviewed controls, or use Windows startup settings for other apps. Scheduled tasks and Windows services are not included.'}</Notice>
    {tab === 'startup' && <StartupControls onBusyChange={onBusyChange}/>}
    {!isDesktop ? <section className="panel"><EmptyState icon={Monitor} title="Meet the apps behind your PC" description={unsupportedMessage}/></section> : <section className="panel">
      <PanelTitle icon={tab === 'processes' ? Activity : Layers} title={tab === 'processes' ? 'Running on your PC' : 'Configured startup apps'} action={<Badge>{count} {tab === 'processes' ? 'PROCESSES' : 'APPS'}</Badge>}/>
      <div className="process-toolbar">
        <label className="search-field"><Search size={16}/><input aria-label={tab === 'processes' ? 'Search processes' : 'Search startup apps'} placeholder={tab === 'processes' ? 'Search by name or process ID…' : 'Search startup apps…'} value={search} onChange={event => setSearch(event.target.value)}/></label>
        {tab === 'processes' && <select className="select" aria-label="Sort processes" value={sort} onChange={event => setSort(event.target.value as typeof sort)}><option value="memory">Highest memory first</option><option value="cpu">Highest CPU time first</option><option value="name">Name A–Z</option></select>}
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {loading ? <div className="panel-empty"><Spinner label={`Reading ${tab === 'processes' ? 'running processes' : 'startup apps'}…`}/></div> : count ? <div className="table-wrap"><table className="data-table"><thead><tr><th scope="col">Application</th>{tab === 'processes' ? <><th scope="col">Process ID</th><th scope="col">Memory</th><th scope="col">CPU time</th><th scope="col">Details</th></> : <><th scope="col">Location</th><th scope="col">Startup status</th></>}</tr></thead><tbody>
        {tab === 'processes' ? filteredProcesses.map(process => <tr key={process.pid}><td><strong>{process.name}</strong></td><td>{process.pid}</td><td>{formatBytes(process.memoryBytes, 1)}</td><td>{process.cpuSeconds === null ? 'Unavailable' : `${process.cpuSeconds.toFixed(1)} s`}</td><td><button className="button secondary" onClick={() => setDetailsPid(process.pid)} aria-label={`Inspect ${process.name} (${process.pid})`}>Details</button></td></tr>) : filteredStartup.map((entry, index) => <tr key={`${entry.location}-${entry.name}-${index}`}><td><strong>{entry.name}</strong></td><td>{entry.location}</td><td><Badge tone={entry.status === 'Disabled' ? '' : 'green'}>{entry.status}</Badge></td></tr>)}
      </tbody></table></div> : !error && <EmptyState icon={Layers} title={search ? 'No matching apps' : tab === 'startup' ? 'No startup entries reported' : 'No process data reported'} description={search ? 'Try a different name or clear your search.' : tab === 'startup' ? 'The supported Windows startup locations have no entries, or this platform does not expose them.' : 'Refresh the list to query your operating system again.'}/>}
      {updated && <p className="benchmark-note">Snapshot updated at {updated}. Refresh to see changes.</p>}
    </section>}
    </>}
    {detailsPid !== null && <ProcessDetails key={detailsPid} pid={detailsPid} close={() => setDetailsPid(null)}/>}
  </>;
}

type Measurement = { average: string; low: string; latency: string; capture?: FrameCapture; context?: BenchmarkContext };
type Benchmark = { game: string; notes: string; before: Measurement; after: Measurement; savedAt: string | null };
const STORAGE_KEY = 'pandora.benchmark.v1';
const blankMeasurement = (): Measurement => ({ average: '', low: '', latency: '' });
const blankBenchmark = (): Benchmark => ({ game: '', notes: '', before: blankMeasurement(), after: blankMeasurement(), savedAt: null });
const measurementFields = [
  { key: 'average', title: 'Average FPS', unit: 'FPS', lowerIsBetter: false, help: 'Average frames per second' },
  { key: 'low', title: '1% low FPS', unit: 'FPS', lowerIsBetter: false, help: 'Frame rate during the slowest 1%' },
  { key: 'latency', title: 'Latency', unit: 'ms', lowerIsBetter: true, help: 'Use the same latency measurement tool' },
] as const;

function numberOrNull(value: string): number | null { return value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) > 0 && Number(value) <= 100_000 ? Number(value) : null; }
function benchmarkErrors(benchmark: Benchmark): string[] {
  const errors: string[] = [];
  for (const phase of ['before', 'after'] as const) {
    const values = benchmark[phase];
    for (const field of measurementFields) if (values[field.key].trim() && numberOrNull(values[field.key]) === null) errors.push(`${phase === 'before' ? 'Before' : 'After'} ${field.title} must be a number greater than zero and no more than 100,000.`);
    const average = numberOrNull(values.average), low = numberOrNull(values.low);
    if (average !== null && low !== null && low > average) errors.push(`${phase === 'before' ? 'Before' : 'After'} 1% low FPS cannot exceed average FPS.`);
  }
  return errors;
}
function readBenchmark(): Benchmark {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!data || typeof data !== 'object') return blankBenchmark();
    const value = data as Partial<Benchmark>;
    if (!value.before || !value.after || typeof value.game !== 'string' || typeof value.notes !== 'string') return blankBenchmark();
    if (!['before', 'after'].every(phase => measurementFields.every(field => typeof (value[phase as 'before' | 'after'] as Measurement)[field.key] === 'string'))) return blankBenchmark();
    const savedAt = typeof value.savedAt === 'string' && Number.isFinite(Date.parse(value.savedAt)) ? value.savedAt : null;
    for (const phase of ['before', 'after'] as const) {
      const measurement = value[phase]!;
      if (!validFrameCapture(measurement.capture) || measurement.average !== measurement.capture.averageFps.toFixed(2) || measurement.low !== measurement.capture.lowFps.toFixed(2)) delete measurement.capture;
      if (!validBenchmarkContext(measurement.context)) delete measurement.context;
    }
    const result: Benchmark = { game: value.game.slice(0, 120), notes: value.notes.slice(0, 1200), before: value.before, after: value.after, savedAt };
    return benchmarkErrors(result).length ? blankBenchmark() : result;
  } catch { return blankBenchmark(); }
}

export function PerformanceLab({ notify }: { notify: (message: string) => void }) {
  const [benchmark, setBenchmark] = useState<Benchmark>(readBenchmark);
  const [errors, setErrors] = useState<string[]>([]);
  const [clearOpen, setClearOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const hasAny = (['before', 'after'] as const).some(phase => Boolean(benchmark[phase].context) || measurementFields.some(field => benchmark[phase][field.key].trim()));
  const differences = contextDifferences(benchmark.before.context, benchmark.after.context);
  const change = (phase: 'before' | 'after', key: 'average' | 'low' | 'latency', value: string) => { setBenchmark(previous => ({ ...previous, [phase]: { ...previous[phase], [key]: value, capture: key === 'latency' ? previous[phase].capture : undefined } })); setDirty(true); setErrors([]); };
  const save = (event: FormEvent) => {
    event.preventDefault();
    const issues = benchmarkErrors(benchmark);
    if (!hasAny) issues.push('Add a measured result or PC configuration snapshot before saving.');
    if (issues.length) { setErrors(issues); return; }
    const updated = { ...benchmark, savedAt: new Date().toISOString() };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); setBenchmark(updated); setDirty(false); setErrors([]); notify('Your measured results are saved on this device.'); }
    catch { setErrors(['PANDORA could not save these results. Local storage may be full or unavailable.']); }
  };
  const clear = () => {
    try { localStorage.removeItem(STORAGE_KEY); setBenchmark(blankBenchmark()); setDirty(false); setErrors([]); setClearOpen(false); notify('Benchmark measurements cleared.'); }
    catch { setErrors(['Local storage is unavailable. Your saved measurements could not be cleared.']); setClearOpen(false); }
  };
  const exportCsv = () => {
    const issues = benchmarkErrors(benchmark);
    if (issues.length) { setErrors(issues); return; }
    const cell = (value: string) => `"${(/^[=+\-@\t\r]/.test(value) ? `'${value}` : value).replaceAll('"', '""')}"`;
    const rows = [['PANDORA — Created by Sonnier', 'Local benchmark measurements; sources listed below'], ['Game', benchmark.game], ['Test conditions', benchmark.notes],
      ...(['before', 'after'] as const).flatMap(phase => {
        const capture = benchmark[phase].capture;
        return [[`${phase} FPS source`, capture ? `Imported ${capture.source} intervals` : 'Manual entry'], ...(capture ? [[`${phase} frame count`, String(capture.frames)], [`${phase} interval duration ms`, String(capture.durationMs)], [`${phase} p99 interval ms`, String(capture.p99Ms)]] : [])];
      }),
      ['1% low method for imports', '1000 / mean of slowest ceil(frame count * 0.01) intervals in ms'],
      ['Latency source', 'Manual entry; never inferred from frame intervals'],
      ...(['before', 'after'] as const).flatMap(phase => benchmark[phase].context ? contextRows(benchmark[phase].context!).map(([key, value]) => [`${phase} ${key}`, value]) : [[`${phase} PC configuration`, 'Not captured']]),
      ['Metric', 'Before', 'After', 'Unit'], ...measurementFields.map(field => [field.title, benchmark.before[field.key], benchmark.after[field.key], field.unit])];
    const blob = new Blob([rows.map(row => row.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'PANDORA-benchmark.csv'; document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('Benchmark CSV download requested.');
  };

  return <>
    <PageHeading eyebrow="BENCHMARKS" title="Performance Lab" description="Record benchmarks and compare measured performance.">
      <button className="button secondary" onClick={exportCsv} disabled={!hasAny}><Download size={16}/>Export CSV</button>
    </PageHeading>
    <Notice>Enter measurements or import a recorded frame-time CSV. PANDORA analyzes your capture locally; it does not record game frames, infer input latency or predict performance gains.</Notice>
    <form onSubmit={save} className="stack">
      <section className="panel">
        <PanelTitle icon={FlaskConical} title="Your test conditions" action={<Badge>REPEATABLE BY DESIGN</Badge>}/>
        <div className="two-columns"><label className="field">Game or benchmark<input className="input" placeholder="Name your test" value={benchmark.game} maxLength={120} onChange={event => { setBenchmark(previous => ({ ...previous, game: event.target.value })); setDirty(true); }}/></label><label className="field">Settings & scenario<input className="input" placeholder="Resolution, graphics preset, map and test duration" value={benchmark.notes} maxLength={1200} onChange={event => { setBenchmark(previous => ({ ...previous, notes: event.target.value })); setDirty(true); }}/></label></div>
        <p className="benchmark-note">Use the same game scene, settings, duration and measuring tool for each run. Warm up first, repeat runs and compare consistent results.</p>
      </section>
      <details className="panel capture-help"><summary>How to import a frame capture</summary><p>Choose a comma-separated CSV with one <code>frame_time_ms</code> or classic PresentMon <code>MsBetweenPresents</code> column, in milliseconds. Include at least 100 frames, up to 250,000 frames and 8 MiB. Export one process and one swap chain; mixed captures are rejected.</p><p>Your file stays on this device. Only calculated summaries are saved when you click Save measurements. Capture filenames, raw rows and process identities are not retained. For a simple file, use <code>frame_time_ms</code> as the first line and one measured interval per line.</p></details>
      <div className="two-columns">
        {(['before', 'after'] as const).map((phase, index) => <section className="panel" key={phase}>
          <PanelTitle icon={index ? Sparkles : Activity} title={index ? 'After your change' : 'Before your change'} action={<Badge>{index ? '02 / COMPARE' : '01 / BASELINE'}</Badge>}/>
          <BenchmarkConfiguration phase={phase} context={benchmark[phase].context} onCapture={context => { setBenchmark(previous => ({ ...previous, [phase]: { ...previous[phase], context } })); setDirty(true); setErrors([]); }}/>
          <FrameImport phase={phase} onImport={capture => { setBenchmark(previous => ({ ...previous, [phase]: { ...previous[phase], average: capture.averageFps.toFixed(2), low: capture.lowFps.toFixed(2), capture } })); setDirty(true); setErrors([]); notify('Captured FPS results added. Save measurements to keep them.'); }}/>
          {benchmark[phase].capture && <details className="capture-help"><summary>Imported capture details</summary><CaptureSummary capture={benchmark[phase].capture!}/></details>}
          <div className="stack">{measurementFields.map(field => <label className="field" key={field.key}>{field.title}<span className="input-unit"><input className="input" type="number" inputMode="decimal" min="0.001" max="100000" step="any" aria-label={`${phase === 'before' ? 'Before' : 'After'} ${field.title}`} placeholder="Not measured" value={benchmark[phase][field.key]} onChange={event => change(phase, field.key, event.target.value)}/><span>{field.unit}</span></span><small className="muted">{field.help}</small></label>)}</div>
        </section>)}
      </div>
      {errors.length > 0 && <Notice tone="error"><ul>{errors.map(error => <li key={error}>{error}</li>)}</ul></Notice>}
      <div className="benchmark-actions"><span className="muted">{dirty ? 'Unsaved measurements' : benchmark.savedAt ? `Saved ${new Date(benchmark.savedAt).toLocaleString()}` : 'Your measurements stay on this device.'}</span><div><button type="button" className="button secondary" onClick={() => setClearOpen(true)} disabled={!hasAny && !benchmark.game && !benchmark.notes}><Trash2 size={16}/>Clear</button><button type="submit" className="button primary"><Save size={16}/>Save measurements</button></div></div>
    </form>
    <div className="section-heading"><h2>Your comparison</h2><span className="muted">Based on your measurements</span></div>
    {differences.length > 0 && <Notice tone="warning">Recorded conditions differ: {differences.join(', ')}. These differences may affect your comparison; they do not establish what caused a change in performance.</Notice>}
    <div className="benchmark-grid">{measurementFields.map(field => {
      const before = numberOrNull(benchmark.before[field.key]), after = numberOrNull(benchmark.after[field.key]);
      const valid = benchmarkErrors(benchmark).length === 0;
      const delta = valid && before !== null && after !== null ? (after - before) / before * 100 : null;
      const improved = delta !== null && (field.lowerIsBetter ? delta < 0 : delta > 0);
      return <section className="panel benchmark-metric" key={field.key}><span className="subtle-label">{field.title}</span><div className="benchmark-result"><span>{before ?? '—'}</span><ArrowRight size={18}/><strong>{after ?? '—'}<small>{field.unit}</small></strong></div>{delta !== null ? <span className={`benchmark-delta ${delta === 0 ? '' : improved ? 'improved' : 'regressed'}`}>{delta === 0 ? <Check size={14}/> : delta > 0 ? <ArrowUp size={14}/> : <ArrowDown size={14}/>} {Math.abs(delta).toFixed(1)}% {delta === 0 ? 'change' : field.lowerIsBetter ? delta < 0 ? 'lower latency' : 'higher latency' : delta > 0 ? 'higher FPS' : 'lower FPS'}</span> : <span className="benchmark-note">Enter both measurements to compare.</span>}</section>;
    })}</div>
    <p className="benchmark-note">Small differences can be normal run-to-run variation. These results do not establish that a setting caused an improvement.</p>
    {clearOpen && <Modal title="Clear your measurements?" description="This removes the current benchmark and its saved copy from this device." onClose={() => setClearOpen(false)} footer={<><button className="button secondary" onClick={() => setClearOpen(false)}>Keep measurements</button><button className="button primary" onClick={clear}><Trash2 size={15}/>Clear measurements</button></>}/>}
  </>;
}

export function Preferences({ settings, setSettings, notify, onBusyChange }: { settings: AppSettings; setSettings: (settings: AppSettings) => void; notify: (message: string) => void; onBusyChange: (busy: boolean) => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const update = async (change: Partial<AppSettings>) => {
    if (saving) return;
    setSaving(true); setError('');
    try { setSettings(await api.saveSettings({ ...settings, ...change })); notify('Preferences saved.'); }
    catch (err) { setError(errorMessage(err)); }
    finally { setSaving(false); }
  };
  return <>
    <PageHeading eyebrow="PREFERENCES" title="Settings & About" description="Configure PANDORA and view application information."/>
    {error && <Notice tone="error">{error}</Notice>}
    <div className="two-columns"><div className="stack"><section className="panel"><PanelTitle icon={Settings} title="Your preferences"/>
      <div className="setting-row"><div><strong>Reduce motion</strong><p>Use a calmer interface with fewer animations.</p></div><Toggle label="Reduce motion" checked={settings.reduceMotion} onChange={value => void update({ reduceMotion: value })} disabled={saving}/></div>
      <div className="setting-row"><div><strong>Live metric refresh</strong><p>Choose how often CPU and memory readings update. GPU readings update at most every 5 seconds.</p></div><select className="select" aria-label="Live metric refresh" value={[1000, 2000, 5000].includes(settings.pollInterval) ? settings.pollInterval : 2000} onChange={event => void update({ pollInterval: Number(event.target.value) })} disabled={saving}><option value={1000}>Every second</option><option value={2000}>Every 2 seconds</option><option value={5000}>Every 5 seconds</option></select></div>
      <div className="setting-row"><div><strong>Detect hardware on launch</strong><p>Read your system information when PANDORA opens. This does not apply optimizations or clean files.</p></div><Toggle label="Detect hardware on launch" checked={settings.scanOnLaunch} onChange={value => void update({ scanOnLaunch: value })} disabled={saving}/></div>
      {saving && <Spinner label="Saving preferences…"/>}
    </section><AppLifecycleSettings settings={settings} saving={saving} update={update} onBusyChange={onBusyChange}/><Notice>System changes always require your review. Cleanup deletions are permanent; optimization history keeps original values so managed tweaks can be reverted.</Notice></div>
    <section className="panel settings-about"><div className="about-mark"><img src="./logo.svg" alt=""/></div><span className="eyebrow">WINDOWS PC UTILITY</span><h2>PANDORA</h2><p>Created by Sonnier</p><Badge>VERSION 0.1.0</Badge><div className="about-divider"/><p>Hardware monitoring, storage cleanup, and reversible Windows settings.</p><dl className="detail-list"><div><dt>Application</dt><dd>PANDORA — Created by Sonnier</dd></div><div><dt>Session</dt><dd>{isDesktop ? 'Local desktop app' : 'Browser preview'}</dd></div><div><dt>Designed for</dt><dd>Windows 10 / 11 · x64</dd></div><div><dt>Performance promises</dt><dd>Based on your measurements</dd></div></dl><div className="local-privacy"><ShieldCheck size={16}/><span>Hardware readings and configuration history stay on your device.</span></div></section></div>
  </>;
}
