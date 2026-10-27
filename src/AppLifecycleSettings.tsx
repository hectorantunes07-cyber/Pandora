import { useEffect, useRef, useState } from 'react';
import { Power, RefreshCw } from 'lucide-react';
import type { AppLifecycleState } from '../shared/app-lifecycle';
import type { AppSettings } from '../shared/types';
import { api, errorMessage, isDesktop } from './api';
import { Badge, Modal, Notice, PanelTitle, Toggle } from './components';
export function AppLifecycleSettings({ settings, saving, update, onBusyChange }: { settings: AppSettings; saving: boolean; update: (change: Partial<AppSettings>) => Promise<void>; onBusyChange: (busy: boolean) => void }) {
  const [state, setState] = useState<AppLifecycleState | null>(null), [busy, setBusy] = useState(false), [review, setReview] = useState<{ token: string; enable: boolean } | null>(null), [message, setMessage] = useState('');
  const pending = useRef(false);
  async function refresh() {
    if (pending.current) return;
    pending.current = true; setBusy(true);
    try { setState(await api.getAppLifecycle()); } catch (e) { setState(null); setMessage(errorMessage(e)); } finally { pending.current = false; setBusy(false); }
  }
  useEffect(() => { void refresh(); }, []);
  async function confirm() {
    if (!review || pending.current) return;
    const request = review; setReview(null); pending.current = true; setBusy(true); onBusyChange(true);
    try { const result = await api.changeAppLogin(request.token, request.enable); setMessage(result.message); }
    catch (e) { setMessage(errorMessage(e)); }
    finally { try { setState(await api.getAppLifecycle()); } catch { setState(null); } pending.current = false; setBusy(false); onBusyChange(false); }
  }
  const login = state?.login;
  return <section className="panel" aria-label="Startup and notification area"><PanelTitle icon={Power} title="Startup & notification area" action={<button className="button secondary compact" disabled={busy || saving} onClick={() => void refresh()}><RefreshCw size={15}/>Refresh</button>}/>
    {message && <Notice>{message}</Notice>}
    <div className="setting-row"><div><strong>Launch PANDORA at sign-in</strong><p>Open the installed app when you sign in to Windows. No optimizations or cleanup run automatically.</p><p>{login?.reason ?? 'Reading startup registration…'}</p>{login?.state === 'owned' && <Badge>{login.approved === false ? 'Disabled by Windows' : login.approved === true ? 'Enabled' : 'Registered · approval unknown'}</Badge>}</div>
      <button className="button secondary compact" disabled={!login?.supported || !login.token || busy || saving} onClick={() => login?.token && setReview({ token: login.token, enable: login.state === 'absent' })}>{login?.state === 'owned' ? 'Disable sign-in launch' : 'Enable sign-in launch'}</button>
    </div>
    <div className="setting-row"><div><strong>Close to notification area</strong><p>Keep PANDORA available from its tray icon when you close the window. Hidden live monitoring pauses. Use Exit PANDORA to quit.</p></div><Toggle label="Close to notification area" checked={settings.closeToTray} disabled={!state?.traySupported || saving || busy} onChange={value => void update({ closeToTray: value })}/></div>
    <div className="lifecycle-actions"><button className="button secondary compact" disabled={!isDesktop || busy} onClick={() => api.openWindowsSettings('startup').catch(e => setMessage(errorMessage(e)))}>Windows startup settings</button><button className="button secondary compact" disabled={!isDesktop || busy || saving} onClick={() => api.windowAction('quit')}>Exit PANDORA</button></div>
    {review && <Modal title={review.enable ? 'Launch PANDORA at sign-in?' : 'Disable PANDORA sign-in launch?'} description={review.enable ? 'Register only this installed PANDORA executable for your Windows account. The app opens normally; tuning and cleanup still require your review. Windows startup approval settings remain in control.' : 'Remove PANDORA’s matching sign-in entry. This does not affect other apps or close the current session.'} onClose={() => setReview(null)} footer={<><button className="button secondary" onClick={() => setReview(null)}>Cancel</button><button className="button primary" onClick={() => void confirm()}>{review.enable ? 'Confirm sign-in launch' : 'Confirm disable'}</button></>}/>}
  </section>;
}
