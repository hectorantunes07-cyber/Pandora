import { useEffect, useState } from 'react';
import { FolderOpen } from 'lucide-react';
import type { ProcessDetails as Details } from '../shared/process-details';
import { api, errorMessage } from './api';
import { Modal, Notice, Spinner } from './components';
export function ProcessDetails({ pid, close }: { pid: number; close: () => void }) {
  const [info, setInfo] = useState<Details | null>(null), [error, setError] = useState('');
  const [loading, setLoading] = useState(true), [opening, setOpening] = useState(false), [opened, setOpened] = useState(false);
  useEffect(() => {
    let active = true;
    void api.getProcessDetails(pid).then(value => { if (active) setInfo(value); }).catch(e => { if (active) setError(errorMessage(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [pid]);
  const open = async () => {
    if (!info?.token) return;
    setOpening(true); setError('');
    try { await api.openProcessLocation(info.token); setOpened(true); }
    catch (e) { setError(errorMessage(e)); }
    finally { setInfo(value => value ? { ...value, token: null } : value); setOpening(false); }
  };
  return <Modal title="Process details" onClose={() => { if (!opening) close(); }}>
    {loading && <Spinner label="Reading the selected process…"/>}
    {error && <Notice tone="error">{error}</Notice>}
    {info && <><dl className="process-details-grid">
      <div><dt>Process</dt><dd>{info.name}</dd></div><div><dt>Process ID</dt><dd>{info.pid}</dd></div>
      <div><dt>Started</dt><dd>{info.startedAt ? new Date(info.startedAt).toLocaleString() : 'Unavailable'}</dd></div>
      <div><dt>Reported company</dt><dd>{info.company || 'Not provided'}</dd></div><div><dt>File version</dt><dd>{info.version || 'Not provided'}</dd></div>
      <div className="process-details-path"><dt>Executable location</dt><dd>{info.executable || 'Unavailable or not a local executable path'}</dd></div>
    </dl><Notice>Company and version are file metadata, not verified publisher or safety checks. Protected processes may hide details. The path stays in this local view and is excluded from reports and activity logs.</Notice>
    {!info.token && !opened && !error && <p>Windows did not provide a stable, accessible local executable identity. File-location access is unavailable.</p>}
    {opened && <Notice>Windows Explorer was asked to show this file. The process was not stopped or changed.</Notice>}
    </>}
    <div className="modal-actions"><button className="button secondary" disabled={opening} onClick={close}>Close details</button><button className="button primary" disabled={!info?.token || opening} onClick={() => void open()}><FolderOpen size={16}/>{opening ? 'Checking process…' : 'Open file location'}</button></div>
  </Modal>;
}
