import { ArrowRight, Lightbulb } from 'lucide-react';
import type { Metrics, SystemInfo, TweakState } from '../shared/types';
import { systemInsights, type InsightRoute } from '../shared/insights';
import { PanelTitle } from './components';

export function Insights({ system, metrics, tweaks, navigate }: { system: SystemInfo | null; metrics: Metrics | null; tweaks: TweakState[]; navigate: (route: InsightRoute) => void }) {
  const items = systemInsights(system, metrics, tweaks);
  if (!items.length) return null;
  return <section className="panel insights-panel" aria-label="Recommendations from your readings">
    <PanelTitle icon={Lightbulb} title="System recommendations"/>
    <p className="accounting-note">Based on available readings. Review each reason before making a change.</p>
    <div className="insights-list">{items.map(item => <article key={item.id}>
      <div><h3>{item.title}</h3><p className="insight-evidence">{item.evidence}</p><p>{item.guidance}</p></div>
      <button className="button secondary compact" onClick={() => navigate(item.route)}>{item.action}<ArrowRight size={14}/></button>
    </article>)}</div>
  </section>;
}
