import { useEffect, useId, useState } from 'react';
import type { Cents } from '../lib/types';
import type { MonthBar, Status } from '../lib/calc';
import { euros, monthName, monthShort } from '../lib/format';

/** Vrai au premier rendu puis faux : sert à animer le remplissage des jauges */
function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setM(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return m;
}

const RING_COLORS: Record<Status, string> = { ok: '#6EE7C5', warn: '#FFD166', over: '#FF6B6B' };

/* ---------- jauge en anneau (carte du Suivi) ---------- */

export function Ring({ ratio, pace, status, size = 140, showPace = true }: { ratio: number; pace: number; status: Status; size?: number; showPace?: boolean }) {
  const mounted = useMounted();
  const stroke = 13;
  const r = (size - stroke) / 2 - 4;
  const c = 2 * Math.PI * r;
  const shown = Math.min(Math.max(ratio, 0), 1);
  const a = pace * 2 * Math.PI - Math.PI / 2;
  const px = size / 2 + r * Math.cos(a);
  const py = size / 2 + r * Math.sin(a);
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={`${Math.round(ratio * 100)} % dépensé, on devrait en être à ${Math.round(pace * 100)} %`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={stroke} />
        <circle
          className="ring-anim"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={RING_COLORS[status]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={mounted ? c * (1 - shown) : c}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          opacity={shown === 0 ? 0 : 1}
        />
        {showPace && <circle cx={px} cy={py} r={6.5} fill="#fff" stroke="#0f3d3b" strokeWidth={2.5} />}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div>
          <div className="pct num">{Math.round(ratio * 100)}%</div>
          <div className="lbl">dépensé</div>
        </div>
      </div>
    </div>
  );
}

/* ---------- rythme du mois : une barre par jour ---------- */

export function DailyBars({ daily, dailyBudget, today, label }: { daily: Cents[]; dailyBudget: Cents; today: number; label: (day: number) => string }) {
  const [sel, setSel] = useState<number | null>(null);
  const W = 340;
  const H = 150;
  const top = 8;
  const n = daily.length;
  const slot = W / n;
  const bw = Math.max(3, slot * 0.6);
  const max = Math.max(...daily, dailyBudget * 1.5, 1);
  const y = (v: number) => H - (v / max) * (H - top);
  const by = y(dailyBudget);
  const tip = sel != null ? `${label(sel + 1)} : ${euros(daily[sel], { decimals: true })}` : ' ';
  return (
    <div>
      <div className="chart-tip num" aria-live="polite">
        {tip}
      </div>
      <svg viewBox={`0 0 ${W} ${H + 4}`} width="100%" role="img" aria-label="Dépenses par jour du mois">
        {daily.map((v, i) => {
          const x = i * slot + (slot - bw) / 2;
          const future = today > 0 && i + 1 > today;
          const isToday = i + 1 === today;
          if (v <= 0) {
            return (
              <g key={i} onClick={() => setSel(i)}>
                <rect x={i * slot} y={0} width={slot} height={H} fill="transparent" />
                <rect
                  x={x}
                  y={H - 7}
                  width={bw}
                  height={7}
                  rx={Math.min(3, bw / 2)}
                  fill={future ? 'none' : 'var(--track)'}
                  stroke={future ? 'var(--faint)' : 'none'}
                  strokeDasharray={future ? '2 2' : undefined}
                  strokeWidth={1}
                  opacity={future ? 0.6 : 1}
                />
                {isToday && <rect x={x - 3} y={H - 10} width={bw + 6} height={13} rx={(bw + 6) / 2} fill="none" stroke="var(--text)" strokeWidth={2} />}
              </g>
            );
          }
          const h = Math.max(H - y(v), 4);
          return (
            <g key={i} onClick={() => setSel(i)}>
              <rect x={i * slot} y={0} width={slot} height={H} fill="transparent" />
              <rect className="grow-y" style={{ animationDelay: `${i * 12}ms` }} x={x} y={H - h} width={bw} height={h} rx={Math.min(4, bw / 2)} fill={v > dailyBudget ? 'var(--peach)' : 'var(--bar-under)'} opacity={sel == null || sel === i ? 1 : 0.55} />
              {isToday && <rect x={x - 3} y={H - h - 3} width={bw + 6} height={h + 6} rx={(bw + 6) / 2} fill="none" stroke="var(--text)" strokeWidth={2} />}
            </g>
          );
        })}
        {dailyBudget > 0 && <line x1={0} x2={W} y1={by} y2={by} stroke="var(--faint)" strokeWidth={1.5} strokeDasharray="5 4" pointerEvents="none" />}
      </svg>
      <div className="chart-legend">
        <span>
          <i style={{ background: 'var(--bar-under)' }} /> sous la moyenne prévue
        </span>
        <span>
          <i style={{ background: 'var(--peach)' }} /> au-dessus
        </span>
        <span>
          <i className="dash" style={{ width: 16 }} /> budget par jour
        </span>
      </div>
    </div>
  );
}

/* ---------- Bilan : une barre par mois ---------- */

export function MonthBars({ bars }: { bars: MonthBar[] }) {
  const [sel, setSel] = useState<number | null>(null);
  const pid = useId().replace(/:/g, '');
  const W = 340;
  const H = 160;
  const top = 10;
  const n = bars.length;
  const slot = W / n;
  const bw = Math.min(34, slot * 0.58);
  const max = Math.max(...bars.map((b) => Math.max(b.spent, b.budget)), 1) * 1.1;
  const y = (v: number) => H - (v / max) * (H - top);
  const s = sel != null ? bars[sel] : null;
  return (
    <div>
      <div className="chart-tip num" aria-live="polite">
        {s ? `${monthName(s.month)} : ${euros(s.spent)} dépensés sur ${euros(s.budget)}` : ' '}
      </div>
      <svg viewBox={`0 0 ${W} ${H + 22}`} width="100%" role="img" aria-label="Dépenses du quotidien par mois">
        <defs>
          <pattern id={`h${pid}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="var(--c)" opacity="0.35" />
            <rect width="3" height="6" fill="var(--c)" />
          </pattern>
        </defs>
        {bars.map((b, i) => {
          const x = i * slot + (slot - bw) / 2;
          const h = b.spent > 0 ? Math.max(H - y(b.spent), 4) : 0;
          const col = b.over ? 'var(--peach)' : 'var(--bar-under)';
          return (
            <g key={b.month} onClick={() => setSel(i)} style={{ '--c': col } as React.CSSProperties}>
              <rect x={i * slot} y={0} width={slot} height={H + 22} fill="transparent" />
              {h > 0 && (
                <rect className="grow-y" style={{ animationDelay: `${i * 50}ms` }} x={x} y={H - h} width={bw} height={h} rx={5} fill={b.current ? `url(#h${pid})` : col} stroke={b.current ? col : 'none'} strokeWidth={b.current ? 1.5 : 0} opacity={sel == null || sel === i ? 1 : 0.55} />
              )}
              {b.budget > 0 && <line x1={i * slot + 2} x2={(i + 1) * slot - 2} y1={y(b.budget)} y2={y(b.budget)} stroke="var(--faint)" strokeWidth={1.5} strokeDasharray="5 4" pointerEvents="none" />}
              <text x={i * slot + slot / 2} y={H + 17} textAnchor="middle" fontSize="12" fill={b.current ? 'var(--text)' : 'var(--muted)'} fontWeight={b.current ? 700 : 500}>
                {n > 6 ? monthShort(b.month).charAt(0).toUpperCase() : monthShort(b.month)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="chart-legend">
        <span>
          <i style={{ background: 'var(--bar-under)' }} /> sous le budget
        </span>
        <span>
          <i style={{ background: 'var(--peach)' }} /> au-dessus
        </span>
        <span>
          <i className="hatch" /> mois en cours
        </span>
        <span>
          <i className="dash" style={{ width: 16 }} /> budget du mois
        </span>
      </div>
    </div>
  );
}

/* ---------- Où part l'argent : anneau ---------- */

export function Donut({ parts, total, size = 160 }: { parts: { id: string; value: number; color: string; label: string }[]; total: Cents; size?: number }) {
  const mounted = useMounted();
  const stroke = 24;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const sum = parts.reduce((a, p) => a + p.value, 0) || 1;
  const gap = parts.length > 1 ? 2.5 : 0;
  let acc = 0;
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }} role="img" aria-label={`Répartition des dépenses : ${euros(total)} au total`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        {parts.map((p) => {
          const len = (p.value / sum) * c;
          const seg = Math.max(len - gap, 0.5);
          const off = acc;
          acc += len;
          return (
            <circle
              key={p.id}
              className="ring-anim"
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={p.color}
              strokeWidth={stroke}
              strokeDasharray={`${mounted ? seg : 0} ${c}`}
              strokeDashoffset={-off}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            >
              <title>{`${p.label} : ${euros(p.value)}`}</title>
            </circle>
          );
        })}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div>
          <div className="t num" style={{ fontWeight: 800, fontSize: size > 150 ? 24 : 20 }}>
            {euros(total)}
          </div>
          <div className="small muted">dépensés</div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Épargne : courbe en aire dorée ---------- */

export function GoldArea({ points, firstLabel, lastLabel }: { points: Cents[]; firstLabel: string; lastLabel: string }) {
  const gid = useId().replace(/:/g, '');
  const [sel, setSel] = useState<number | null>(null);
  const W = 320;
  const H = 120;
  const pad = 8;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || Math.max(max, 1);
  const lo = max === min ? min - span : min;
  const x = (i: number) => pad + (i / Math.max(points.length - 1, 1)) * (W - pad * 2);
  const y = (v: number) => H - 10 - ((v - lo) / (max - lo || 1)) * (H - 30);
  const line = points.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1)},${H} L${x(0)},${H} Z`;
  const last = points.length - 1;
  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Évolution du total épargné sur 6 mois">
        <defs>
          <linearGradient id={`g${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F6C453" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#F6C453" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#g${gid})`} className="fade-in" />
        <path d={line} fill="none" stroke="#F6C453" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((v, i) => (
          <rect key={i} x={x(i) - 20} y={0} width={40} height={H} fill="transparent" onClick={() => setSel(i)} />
        ))}
        {sel != null && sel !== last && <circle cx={x(sel)} cy={y(points[sel])} r={5} fill="#F6C453" stroke="#1a2a52" strokeWidth={2} />}
        <circle cx={x(last)} cy={y(points[last])} r={6} fill="#F6C453" stroke="#1a2a52" strokeWidth={2.5} />
      </svg>
      <div className="row small" style={{ justifyContent: 'space-between', opacity: 0.75, marginTop: 4 }}>
        <span>{firstLabel}</span>
        {sel != null && <span className="num" style={{ fontWeight: 700, opacity: 1 }}>{euros(points[sel])}</span>}
        <span>{lastLabel}</span>
      </div>
    </div>
  );
}
