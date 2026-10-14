import { useEffect, useRef, useState } from 'react';
import { Monitor, RefreshCw } from 'lucide-react';
import type { GpuTelemetry as Snapshot } from '../shared/gpu-telemetry';
import { api, errorMessage, isDesktop } from './api';
import { Badge, Notice, PanelTitle, Spinner } from './components';
const reading = (v: number | null, unit: string) => v === null ? 'Unavailable' : `${v.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${unit}`;
const memory = (v: number | null) => v === null ? 'Unavailable' : v >= 1024 ** 3 ? `${(v / 1024 ** 3).toFixed(1)} GiB` : `${(v / 1024 ** 2).toFixed(1)} MiB`;
export function GpuTelemetry() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const pending = useRef(false);
  async function refresh() {
    if (pending.current || !isDesktop) return;
    pending.current = true;
    setBusy(true); setError('');
    try { setSnapshot(await api.getGpuTelemetry()); } catch (e) { setSnapshot(null); setError(errorMessage(e)); } finally { pending.current = false; setBusy(false); }
  }
  useEffect(() => { void refresh(); }, []);
  return <section className="panel gpu-telemetry" aria-label="NVIDIA hardware readings"><PanelTitle icon={Monitor} title="NVIDIA hardware readings" action={<button className="button secondary compact" disabled={!isDesktop || busy} onClick={() => void refresh()}><RefreshCw size={15} className={busy ? 'spin' : ''}/>Refresh GPU readings</button>}/>
    <p className="benchmark-note">Read-only driver snapshots. Refresh to check again; queries run at most once every 15 seconds. GPU indices identify this snapshot, not a game’s rendering GPU.</p>
    {busy && <Spinner label="Reading NVIDIA hardware…"/>}{error && <Notice tone="error">{error}</Notice>}{!isDesktop && <Notice>Open the Windows app to read supported NVIDIA hardware.</Notice>}{snapshot?.reason && <Notice>{snapshot.reason}</Notice>}
    {snapshot?.devices.map(device => <article className="gpu-device" key={device.index}><div className="panel-title"><h3>{device.name}</h3><Badge>GPU {device.index}</Badge></div><dl className="gpu-reading-grid">
      <div><dt>Dedicated memory used</dt><dd>{memory(device.memoryUsedBytes)}</dd></div><div><dt>Dedicated memory total</dt><dd>{memory(device.memoryTotalBytes)}</dd></div>
      <div><dt>GPU temperature</dt><dd>{reading(device.temperatureC, '°C')}</dd></div><div><dt>Reported power draw</dt><dd>{reading(device.powerWatts, 'W')}</dd></div>
      <div><dt>Graphics clock</dt><dd>{reading(device.graphicsMHz, 'MHz')}</dd></div><div><dt>Driver utilization</dt><dd>{reading(device.utilizationPercent, '%')}</dd></div>
    </dl></article>)}
    {snapshot && <p className="accounting-note">{snapshot.status === 'available' ? 'Sample collected' : 'Provider checked'} {new Date(snapshot.timestamp).toLocaleString()} · NVIDIA SMI{snapshot.cached ? ' · Cached within 15 seconds' : ''}</p>}
    <p className="accounting-note">NVIDIA-only provider. Memory accounting, power sampling and utilization vary by driver and device; these readings are separate from Windows 3D-engine usage above. A single temperature reading cannot establish throttling or safe operating limits. CPU temperature and AMD/Intel sensor providers are not available yet.</p>
  </section>;
}
