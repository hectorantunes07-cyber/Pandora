import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { MAX_CAPTURE_BYTES, parseFrameCapture, type FrameCapture } from '../shared/frame-capture';
import { errorMessage } from './api';
import { Modal, Notice } from './components';

export function CaptureSummary({ capture }: { capture: FrameCapture }) {
  const points = capture.peaks.map((value, i) => `${i / Math.max(1, capture.peaks.length - 1) * 500},${100 - value / capture.maxMs * 96}`).join(' ');
  return <div className="capture-summary">
    <dl className="detail-list"><div><dt>Imported frames</dt><dd>{capture.frames.toLocaleString()}</dd></div><div><dt>Recorded interval duration</dt><dd>{(capture.durationMs / 1000).toFixed(2)} s</dd></div><div><dt>Average / 1% low</dt><dd>{capture.averageFps.toFixed(2)} / {capture.lowFps.toFixed(2)} FPS</dd></div><div><dt>99th percentile / longest frame</dt><dd>{capture.p99Ms.toFixed(2)} / {capture.maxMs.toFixed(2)} ms</dd></div></dl>
    <svg className="frame-chart" viewBox="0 0 500 104" role="img" aria-label={`Frame interval peaks across the capture. Longest interval ${capture.maxMs.toFixed(2)} milliseconds. Higher peaks mean slower frames.`}><polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke"/></svg>
    <p className="benchmark-note">Start → end · Peak interval per frame bucket, scaled from 0 to {capture.maxMs.toFixed(2)} ms. Higher is slower.</p>
    {capture.warnings.map(warning => <Notice key={warning} tone="warning">{warning}</Notice>)}
  </div>;
}

export function FrameImport({ phase, onImport }: { phase: 'before' | 'after'; onImport: (capture: FrameCapture) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [capture, setCapture] = useState<FrameCapture | null>(null);
  const [error, setError] = useState('');
  const read = async (file?: File) => {
    if (!file) return;
    setReading(true); setError('');
    try {
      if (file.size > MAX_CAPTURE_BYTES) throw new Error('Choose a capture no larger than 8 MiB.');
      setCapture(parseFrameCapture(await file.text()));
    } catch (err) { setError(errorMessage(err)); }
    finally { setReading(false); if (input.current) input.current.value = ''; }
  };
  return <div className="capture-import">
    <input ref={input} type="file" accept=".csv,text/csv" aria-label={`Choose ${phase} frame capture`} hidden onChange={event => void read(event.target.files?.[0])}/>
    <button type="button" className="button secondary" disabled={reading} onClick={() => input.current?.click()}><Upload size={16}/>{reading ? 'Reading capture…' : `Import ${phase} capture`}</button>
    {error && <Notice tone="error">{error}</Notice>}
    {capture && <Modal title={`Review ${phase} capture`} description="Review the calculated results before replacing this run’s FPS values. Your latency entry stays separate and unchanged." onClose={() => setCapture(null)} footer={<><button type="button" className="button secondary" onClick={() => setCapture(null)}>Cancel import</button><button type="button" className="button primary" onClick={() => { onImport(capture); setCapture(null); }}>Use captured results</button></>}>
      <CaptureSummary capture={capture}/>
      <Notice>Average FPS = frames ÷ total interval time. 1% low = 1,000 ÷ mean of the slowest 1% of intervals (rounded up to whole frames). Other tools may use different definitions.</Notice>
      <p className="benchmark-note">These intervals do not measure input latency or prove displayed FPS. No stalls or dropped-frame rows are filtered out. Use one process and swap chain, and the same capture tool for both runs.</p>
    </Modal>}
  </div>;
}
