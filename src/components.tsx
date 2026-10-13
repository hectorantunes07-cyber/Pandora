import { useEffect, useRef, type ReactNode } from 'react';
import { ArrowUpRight, Check, CircleHelp, Info, LoaderCircle, ShieldCheck, X, type LucideIcon } from 'lucide-react';

export function IconBox({ icon: Icon, tone = '' }: { icon: LucideIcon; tone?: string }) { return <span className={`icon-box ${tone}`}><Icon size={19}/></span>; }
export function Badge({ children, tone = '' }: { children: ReactNode; tone?: string }) { return <span className={`badge ${tone}`}>{children}</span>; }
export function PageHeading({ eyebrow, title, description, children }: { eyebrow?: string; title: string; description: string; children?: ReactNode }) {
  return <div className="page-heading"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1><p>{description}</p></div>{children && <div className="heading-actions">{children}</div>}</div>;
}
export function EmptyState({ icon: Icon = CircleHelp, title, description, children }: { icon?: LucideIcon; title: string; description: string; children?: ReactNode }) {
  return <div className="empty-state"><IconBox icon={Icon}/><h3>{title}</h3><p>{description}</p>{children}</div>;
}
export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'success' | 'warning' | 'error' }) {
  const Icon = tone === 'success' ? ShieldCheck : Info;
  return <div className={`notice ${tone}`} role={tone === 'error' ? 'alert' : undefined}><Icon size={17}/><div>{children}</div></div>;
}
export function Spinner({ label = 'Working…' }: { label?: string }) { return <span className="loading-inline"><LoaderCircle className="spin" size={17}/>{label}</span>; }
export function Toggle({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: (checked: boolean) => void; label: string; disabled?: boolean }) {
  return <button type="button" className={`toggle ${checked ? 'on' : ''}`} role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} disabled={disabled}><span/></button>;
}
export function PanelTitle({ icon: Icon, title, action }: { icon?: LucideIcon; title: string; action?: ReactNode }) {
  return <div className="panel-title"><h2>{Icon && <Icon size={17}/>} {title}</h2>{action}</div>;
}
export function Modal({ title, description, children, onClose, footer, busy = false }: { title: string; description?: string; children?: ReactNode; onClose: () => void; footer?: ReactNode; busy?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose); close.current = onClose;
  const busyRef = useRef(busy); busyRef.current = busy;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const priorOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    ref.current?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busyRef.current) close.current();
      if (event.key !== 'Tab') return;
      const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]') || []);
      const first = items[0], last = items[items.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handler);
    return () => { document.removeEventListener('keydown', handler); document.body.style.overflow = priorOverflow; previous?.focus(); };
  }, []);
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby={description ? 'dialog-description' : undefined} tabIndex={-1} ref={ref}><div className="modal-head"><IconBox icon={ShieldCheck}/><button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose} disabled={busy}><X size={20}/></button></div><h2 id="dialog-title">{title}</h2>{description && <p id="dialog-description" className="muted">{description}</p>}<div className="modal-body">{children}</div>{footer && <div className="modal-footer">{footer}</div>}</div></div>;
}
export function Meter({ value, small = false, tone = '' }: { value: number | null; small?: boolean; tone?: string }) {
  const safeValue = value == null ? 0 : Math.max(0, Math.min(100, value));
  return <div className={`meter ${small ? 'small' : ''} ${tone}`}><svg viewBox="0 0 100 100" aria-hidden="true"><circle className="meter-track" cx="50" cy="50" r="42"/><circle className="meter-fill" cx="50" cy="50" r="42" strokeDasharray={`${safeValue * 2.64} 264`}/></svg><span>{value == null ? '—' : Math.round(value)}{value != null && <small>%</small>}</span></div>;
}
export function Chart({ values, label, tone = '' }: { values: (number | null)[]; label: string; tone?: string }) {
  const valid = values.filter((value): value is number => value != null);
  const points = values.map((value, i) => value == null ? '' : `${(i / Math.max(1, values.length - 1)) * 600},${145 - (value / 100) * 130}`).filter(Boolean).join(' ');
  return <div className={`chart ${tone}`} role="img" aria-label={valid.length > 1 ? `${label}: ${Math.round(valid.at(-1)!)} percent, ${valid.length} recent samples` : `${label}: waiting for live samples`}><div className="chart-grid"><span>100%</span><span>50%</span><span>0%</span></div>{valid.length > 1 ? <svg viewBox="0 0 600 160" preserveAspectRatio="none"><polygon points={`0,160 ${points} 600,160`} fill="currentColor" opacity="0.08"/><polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke"/></svg> : <div className="chart-unavailable">{valid.length === 1 ? 'Collecting live samples…' : 'Live telemetry appears here in the Windows app'}</div>}<div className="chart-axis"><span>Recent activity</span><span>Now</span></div></div>;
}
export function ActionLink({ children, onClick }: { children: ReactNode; onClick: () => void }) { return <button className="text-button" onClick={onClick}>{children}<ArrowUpRight size={14}/></button>; }
export function Checkbox({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: () => void; label: string; disabled?: boolean }) {
  return <label className={`checkbox-wrap ${disabled ? 'disabled' : ''}`}><input type="checkbox" checked={checked} onChange={onChange} aria-label={label} disabled={disabled}/><span className="checkbox-visual">{checked && <Check size={13}/>}</span></label>;
}
