import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, Package, RefreshCw, Search } from 'lucide-react';
import { OPTIONAL_APPS, type OptionalAppsInfo, type OptionalAppId } from '../shared/optional-apps';
import { api, errorMessage, isDesktop, unsupportedMessage } from './api';
import { Badge, EmptyState, Modal, Notice, PanelTitle, Spinner } from './components';

export function OptionalApps() {
  const [info, setInfo] = useState<OptionalAppsInfo | null>(null);
  const [busy, setBusy] = useState(false), [opening, setOpening] = useState(false);
  const [error, setError] = useState(''), [query, setQuery] = useState('');
  const [filter, setFilter] = useState('installed'), [review, setReview] = useState<OptionalAppId | null>(null);
  const [opened, setOpened] = useState(false);
  const refresh = useCallback(async () => {
    if (!isDesktop) return;
    setBusy(true); setError(''); setReview(null);
    try { setInfo(await api.getOptionalApps()); setOpened(false); }
    catch (e) { setInfo(null); setError(errorMessage(e)); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const shown = (info?.entries ?? []).filter(e => (filter === 'all' || e.state === filter) && (() => {
    const a = OPTIONAL_APPS.find(a => a.id === e.id)!; return `${a.name} ${a.packageName} ${a.purpose}`.toLowerCase().includes(query.toLowerCase().trim());
  })());
  const chosen = OPTIONAL_APPS.find(a => a.id === review);
  const current = info?.entries.find(e => e.id === review);
  const open = async () => {
    setOpening(true); setError('');
    try { await api.openWindowsSettings('apps'); setReview(null); setOpened(true); }
    catch (e) { setError(errorMessage(e)); }
    finally { setOpening(false); }
  };
  return <section className="panel optional-apps">
    <PanelTitle icon={Package} title="Optional Windows apps" action={<button className="button secondary" disabled={!isDesktop || busy || opening} onClick={() => void refresh()}><RefreshCw size={16}/>{busy ? 'Checking apps…' : 'Refresh apps'}</button>}/>
    <p className="benchmark-note">Review optional app registrations for your Windows account. An installed app is not necessarily running or affecting game performance.</p>
    <Notice>Uninstalling is managed by Windows and may delete app data. PANDORA’s setting backups cannot undo it. The Microsoft Store, Edge/WebView2, security components, drivers, and Windows system packages are outside this inventory.</Notice>
    {!isDesktop ? <EmptyState icon={Package} title="Windows app inventory" description={unsupportedMessage}/> : <>
      {error && <Notice tone="error">{error}</Notice>}
      {opened && <Notice>Windows Installed apps was opened. Search for the selected app, review Windows’ uninstall information, and cancel if unsure. Return here and refresh after any change.</Notice>}
      {busy ? <div className="panel-empty"><Spinner label="Reading optional app registrations…"/></div> : info && <>
        {!info.complete && <Notice tone="warning">Some registrations could not be checked. Unavailable apps are not counted as absent.</Notice>}
        <div className="optional-app-toolbar"><label className="search-field"><Search size={16}/><input aria-label="Search optional apps" placeholder="Search apps or package names…" value={query} onChange={e => setQuery(e.target.value)}/></label><select className="select" aria-label="Optional app status" value={filter} onChange={e => setFilter(e.target.value)}><option value="installed">Installed</option><option value="all">All checked apps</option><option value="not-installed">Not installed</option><option value="unavailable">Unavailable</option></select><Badge>{info.entries.filter(e => e.state === 'installed').length} INSTALLED</Badge></div>
        <div className="optional-app-grid">{shown.map(entry => {
          const app = OPTIONAL_APPS.find(a => a.id === entry.id)!;
          const protectedApp = entry.packages.some(p => p.protected), healthy = entry.packages.every(p => p.status === 'Ok');
          return <article className="optional-app-card" key={entry.id}>
            <div className="optional-app-title"><div><h3>{app.name}</h3><p>{app.purpose}</p></div><Badge tone={entry.state === 'unavailable' || protectedApp ? 'amber' : entry.state === 'installed' ? 'purple' : ''}>{entry.state === 'installed' ? protectedApp ? 'WINDOWS PROTECTED' : 'INSTALLED' : entry.state === 'not-installed' ? 'NOT INSTALLED' : 'UNAVAILABLE'}</Badge></div>
            <code>{app.packageName}</code>
            {entry.packages.map(p => <p className="optional-app-version" key={`${p.version}:${p.architecture}`}>Version {p.version} · {p.architecture} · {p.status}</p>)}
            <p>{entry.reason ?? (entry.state === 'not-installed' ? 'No matching registration was reported for your account. Other accounts and provisioned packages are not scanned.' : app.caution)}</p>
            {!healthy && <p>Windows reports a package issue. Review it in Windows Settings; registration does not prove the app can launch.</p>}
            {entry.state === 'installed' && !protectedApp && <button className="button secondary" disabled={opening} onClick={() => { setError(''); setReview(entry.id); }}>Review in Windows<ArrowUpRight size={16}/></button>}
            {protectedApp && <p>Windows marks this registration as non-removable. PANDORA provides no removal control.</p>}
          </article>;
        })}</div>
        {!shown.length && <EmptyState icon={Package} title="No apps match this view" description={query ? 'Clear the search or select another status.' : 'Select All checked apps to see absent or unavailable registrations. This is a limited inventory, not a scan of every installed program.'}/>}
        <p className="benchmark-note">Checked {new Date(info.timestamp).toLocaleString()} · {OPTIONAL_APPS.length} selected app families · Current user only. Package registrations do not establish reclaimable disk space or an FPS benefit.</p>
      </>}
    </>}
    {chosen && current?.state === 'installed' && <Modal title={`Review ${chosen.name}`} onClose={() => { if (!opening) setReview(null); }}>
      <p>{chosen.caution}</p><Notice tone="warning">This opens Windows Settings; it does not uninstall anything. App removal may delete local data and cannot be rolled back with PANDORA’s setting backups. Reinstalling an app does not guarantee recovery of its data.</Notice>
      <ol className="optional-app-steps"><li>Save your work and back up this app’s data.</li><li>Search Installed apps for <strong>{chosen.name}</strong>. The display name can vary by version or language.</li><li>Review the app’s publisher and Windows’ uninstall confirmation. Leave it installed if you use it or are unsure.</li><li>Return to PANDORA and refresh the app inventory.</li></ol>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="modal-actions"><button className="button secondary" disabled={opening} onClick={() => setReview(null)}>Keep app</button><button className="button primary" disabled={opening} onClick={() => void open()}>{opening ? <Spinner label="Opening Windows Settings…"/> : 'Open Installed apps'}<ArrowUpRight size={16}/></button></div>
    </Modal>}
  </section>;
}
