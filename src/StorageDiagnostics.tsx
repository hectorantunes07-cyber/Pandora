import { useRef, useState } from 'react';
import { HardDrive, RefreshCw } from 'lucide-react';
import type { StorageReliability } from '../shared/storage-reliability';
import { api, errorMessage, formatBytes, isDesktop } from './api';
import { Badge, Notice, PanelTitle, Spinner } from './components';

const reading = (value: number | null, unit: string) => value === null ? 'Unavailable' : `${value.toLocaleString()} ${unit}`;
const count = (value: string | null) => value === null ? 'Unavailable' : BigInt(value).toLocaleString();
const reasons = {
  'provider-unavailable': 'Counters are unavailable for this device. Its driver or Windows permissions may prevent access.',
  'not-reported': 'This device did not report supported reliability counters.',
  'identity-mismatch': 'Windows returned counters for a different device. They have been omitted.',
  'ambiguous-response': 'Windows returned more than one counter set for this device. They have been omitted.',
};
export function StorageDiagnostics() {
  const [snapshot, setSnapshot] = useState<StorageReliability | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const pending = useRef(false);
  async function refresh() {
    if (pending.current || !isDesktop) return;
    pending.current = true; setBusy(true); setError('');
    try { setSnapshot(await api.getStorageReliability()); }
    catch (e) { setSnapshot(null); setError(errorMessage(e)); }
    finally { pending.current = false; setBusy(false); }
  }
  return <section className="panel storage-diagnostics" aria-label="Drive diagnostics">
    <PanelTitle icon={HardDrive} title="Drive diagnostics" action={<button className="button secondary compact" disabled={!isDesktop || busy} onClick={() => void refresh()}><RefreshCw size={15} className={busy ? 'spin' : ''}/>{snapshot ? 'Refresh drive counters' : 'Read drive counters'}</button>}/>
    <p className="benchmark-note">Read temperature, endurance usage and error counters from the Windows storage provider. Queries run on request, at most once every 30 seconds.</p>
    {!isDesktop && <Notice>Open the Windows app to inspect supported storage devices.</Notice>}
    {busy && <Spinner label="Reading drive counters…"/>}{error && <Notice tone="error">{error}</Notice>}{snapshot?.reason && <Notice>{snapshot.reason}</Notice>}
    {snapshot?.truncated && <Notice>Showing the first 32 devices returned by Windows.</Notice>}
    {snapshot?.devices.map(device => <article className="storage-device" key={device.index}>
      <div className="panel-title"><h3>{device.model}</h3><Badge>{device.countersStatus === 'reported' ? 'Reported counters' : 'Counters unavailable'}</Badge></div>
      <p className="benchmark-note">Device {device.index + 1} in this snapshot · {device.media} · {device.bus} · {formatBytes(device.bytes, 1)} · Provider health: {device.health}</p>
      {device.reason && <Notice>{reasons[device.reason]}</Notice>}
      <dl className="storage-reading-grid"><div><dt>Reported temperature</dt><dd>{reading(device.temperatureC, '°C')}</dd></div><div><dt>Reported wear</dt><dd>{reading(device.wearPercent, '%')}</dd></div><div><dt>Power-on hours</dt><dd>{reading(device.powerOnHours, 'h')}</dd></div></dl>
      <details className="storage-errors"><summary>Read and write error counters</summary><dl className="storage-reading-grid">
        <div><dt>Total read errors</dt><dd>{count(device.readErrorsTotal)}</dd></div><div><dt>Corrected read errors</dt><dd>{count(device.readErrorsCorrected)}</dd></div><div><dt>Uncorrected read errors</dt><dd>{count(device.readErrorsUncorrected)}</dd></div>
        <div><dt>Total write errors</dt><dd>{count(device.writeErrorsTotal)}</dd></div><div><dt>Corrected write errors</dt><dd>{count(device.writeErrorsCorrected)}</dd></div><div><dt>Uncorrected write errors</dt><dd>{count(device.writeErrorsUncorrected)}</dd></div>
      </dl></details>
      {device.wearPercent !== null && device.wearPercent >= 100 && <Notice>The provider reports that the estimated wear limit has been reached. Check the manufacturer’s drive diagnostics and keep a current backup; this reading does not predict when a drive will fail.</Notice>}
      {[device.readErrorsUncorrected, device.writeErrorsUncorrected].some(v => v !== null && BigInt(v) > 0n) && <Notice>Windows reports uncorrected errors for this device. Compare with the manufacturer’s diagnostics and keep a current backup. These counters alone do not establish the cause or timing.</Notice>}
    </article>)}
    {snapshot && <p className="accounting-note">{snapshot.status === 'available' ? 'Snapshot collected' : 'Provider checked'} {new Date(snapshot.timestamp).toLocaleString()} · Windows Storage{snapshot.cached ? ' · Cached within 30 seconds' : ''}</p>}
    <p className="accounting-note">Wear is estimated endurance used; 100% is the reported wear limit, not remaining life. Missing values stay unavailable. A reported zero or “Healthy” status does not prove a drive is fault-free. USB, RAID and virtual devices may hide counters. Device numbers identify this snapshot, not Windows disk numbers or drive letters. No self-test, repair, reset or disk change is performed.</p>
  </section>;
}
