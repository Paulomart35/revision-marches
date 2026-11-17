// Petit composant de graphique SVG commun aux outils : courbes, repères, marqueurs.
import type { ReactNode } from 'react';

export interface Serie { points: [number, number][]; classe?: string; pointille?: boolean; nom?: string }
export interface Marqueur { x: number; y: number; classe?: string; forme?: 'rond' | 'haut' | 'bas' }

interface Props {
  series: Serie[];
  x?: [number, number];
  y?: [number, number];
  xTicks?: number[];
  yTicks?: number[];
  xFormat?: (v: number) => string;
  yFormat?: (v: number) => string;
  hauteur?: number;
  marqueurs?: Marqueur[];
  verticales?: { x: number; label?: string }[];
  horizontales?: { y: number; label?: string; classe?: string }[];
  bandes?: { points: [number, number, number][]; classe?: string }[]; // x, bas, haut
  titre: string;
  enfants?: ReactNode;
}

export function ticks(min: number, max: number, n = 5): number[] {
  const brut = (max - min) / n;
  const p = Math.pow(10, Math.floor(Math.log10(brut || 1)));
  const pas = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= brut) ?? brut;
  const t: number[] = [];
  for (let v = Math.ceil(min / pas) * pas; v <= max + pas * 1e-9; v += pas) t.push(Math.round(v / pas) * pas);
  return t;
}

const fr = (v: number) => (Math.abs(v) < 1e-9 ? 0 : v).toLocaleString('fr-FR', { maximumFractionDigits: 2 });

export function Graphe(p: Props) {
  const L = 340, H = p.hauteur ?? 200, x0 = 40, y0 = 10, w = L - x0 - 10, h = H - y0 - 24;
  const tous = p.series.flatMap((s) => s.points).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
  const bandes = (p.bandes ?? []).flatMap((b) => b.points.flatMap(([a, lo, hi]) => [[a, lo], [a, hi]] as [number, number][]));
  const xs = [...tous, ...bandes].map((q) => q[0]), ys = [...tous, ...bandes].map((q) => q[1]);
  const xd = p.x ?? [Math.min(...xs), Math.max(...xs)];
  let yd = p.y ?? [Math.min(...ys), Math.max(...ys)];
  if (!p.y) { const m = (yd[1] - yd[0]) * 0.08 || 1; yd = [yd[0] - m, yd[1] + m]; }
  const X = (v: number) => x0 + ((v - xd[0]) / (xd[1] - xd[0] || 1)) * w;
  const Y = (v: number) => y0 + (1 - (v - yd[0]) / (yd[1] - yd[0] || 1)) * h;
  const fx = p.xFormat ?? fr, fy = p.yFormat ?? fr;
  const chemin = (pts: [number, number][]) =>
    pts.filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b))
      .map(([a, b], i) => `${i ? 'L' : 'M'}${X(a).toFixed(1)},${Y(Math.max(yd[0], Math.min(yd[1], b))).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${L} ${H}`} role="img" aria-label={p.titre} className="graphe">
      {(p.yTicks ?? ticks(yd[0], yd[1], 4)).map((v) => (
        <g key={'y' + v}><line x1={x0} x2={x0 + w} y1={Y(v)} y2={Y(v)} className={v === 0 ? 'zero' : 'axe'} /><text x={x0 - 4} y={Y(v) + 3} className="petit" textAnchor="end">{fy(v)}</text></g>
      ))}
      {(p.xTicks ?? ticks(xd[0], xd[1], 5)).map((v) => <text key={'x' + v} x={X(v)} y={H - 6} className="petit" textAnchor="middle">{fx(v)}</text>)}
      {(p.bandes ?? []).map((b, i) => (
        <path key={'b' + i} className={b.classe ?? 'bande'} d={`${b.points.map(([a, , hi], k) => `${k ? 'L' : 'M'}${X(a).toFixed(1)},${Y(hi).toFixed(1)}`).join(' ')} ${[...b.points].reverse().map(([a, lo]) => `L${X(a).toFixed(1)},${Y(lo).toFixed(1)}`).join(' ')} Z`} />
      ))}
      {(p.horizontales ?? []).map((l, i) => (
        <g key={'h' + i}><line x1={x0} x2={x0 + w} y1={Y(l.y)} y2={Y(l.y)} className={l.classe ?? 'repere'} />{l.label && <text x={x0 + w} y={Y(l.y) - 3} className="petit" textAnchor="end">{l.label}</text>}</g>
      ))}
      {(p.verticales ?? []).map((l, i) => (
        <g key={'v' + i}><line x1={X(l.x)} x2={X(l.x)} y1={y0} y2={y0 + h} className="repere" />{l.label && <text x={X(l.x) + 3} y={y0 + 9} className="petit">{l.label}</text>}</g>
      ))}
      {p.series.map((s, i) => <path key={'s' + i} d={chemin(s.points)} className={`courbe ${s.classe ?? ''}`} strokeDasharray={s.pointille ? '5 4' : undefined} />)}
      {(p.marqueurs ?? []).map((m, i) => {
        const cx = X(m.x), cy = Y(m.y);
        if (m.forme === 'haut') return <path key={'m' + i} d={`M${cx},${cy - 6} l4,7 h-8 Z`} className={m.classe ?? 'pt-vert'} />;
        if (m.forme === 'bas') return <path key={'m' + i} d={`M${cx},${cy + 6} l4,-7 h-8 Z`} className={m.classe ?? 'pt-rouge'} />;
        return <circle key={'m' + i} cx={cx} cy={cy} r={5} className={m.classe ?? 'point'} />;
      })}
      {p.enfants}
    </svg>
  );
}

/** Légende de séries, alignée avec les classes de couleur des courbes. */
export function Legende({ items }: { items: { nom: string; classe?: string; pointille?: boolean }[] }) {
  return (
    <div className="legende">
      {items.map((i) => <span key={i.nom}><i className={`trait ${i.classe ?? ''} ${i.pointille ? 'pointille' : ''}`} />{i.nom}</span>)}
    </div>
  );
}
