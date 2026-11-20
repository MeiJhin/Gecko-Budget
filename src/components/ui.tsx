import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Kind, Person, Settings, Tx } from '../lib/types';
import { PERSON_COLORS } from '../lib/defaults';
import { categoryOf } from '../lib/calc';
import { dayLabel, euros, shortDate } from '../lib/format';
import { L } from '../lib/i18n';

/* ---------- icônes au trait ---------- */

const paths: Record<string, ReactNode> = {
  gear: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5" />
      <circle cx="12" cy="12" r="7" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  left: <path d="M14.5 6 8.5 12l6 6" />,
  right: <path d="M9.5 6l6 6-6 6" />,
  plus: <path d="M12 4.5v15M4.5 12h15" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  back: (
    <>
      <path d="M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7z" />
      <path d="m12 9.5 5 5M17 9.5l-5 5" />
    </>
  ),
  cloud: <path d="M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.1 9.5 4.3 4.3 0 0 0 7 18z" />,
};

export function Icon({ name, size = 22, stroke = 2 }: { name: keyof typeof paths | string; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

/* ---------- pastilles ---------- */

export function Ico({ icon, color, size = 48, radius }: { icon: string; color: string; size?: number; radius?: number }) {
  return (
    <span className="ico" style={{ '--c': color, width: size, height: size, fontSize: size * 0.52, borderRadius: radius ?? size * 0.3 } as CSSProperties} aria-hidden="true">
      {icon}
    </span>
  );
}

export function Avatar({ person, names, size = 26 }: { person: Person; names: [string, string]; size?: number }) {
  const n = names[person - 1] || (person === 1 ? 'A' : 'B');
  return (
    <span className="avatar" style={{ width: size, height: size, background: PERSON_COLORS[person], fontSize: size * 0.46 }} aria-hidden="true">
      {n.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/* ---------- panneau qui glisse du bas ---------- */

export function Sheet({
  title,
  onClose,
  children,
  footer,
  label,
  z = 0,
  closeSignal,
}: {
  title?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  label?: string;
  z?: number;
  /** passe à true pour refermer le panneau avec son animation */
  closeSignal?: boolean;
}) {
  const [closing, setClosing] = useState(false);
  const close = () => {
    if (closing) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return onClose();
    setClosing(true);
    setTimeout(onClose, 200);
  };
  useEffect(() => {
    if (closeSignal) close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closeSignal]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const zi = z ? { zIndex: 40 + z * 2 } : undefined;
  return createPortal(
    <>
      <div className={`scrim${closing ? ' closing' : ''}`} onClick={close} style={zi} />
      <div className={`sheet${closing ? ' closing' : ''}`} role="dialog" aria-modal="true" aria-label={label ?? (typeof title === 'string' ? title : undefined)} style={z ? { zIndex: 41 + z * 2 } : undefined}>
        <div className="handle" />
        {title !== undefined && (
          <div className="sheet-head">
            <h2>{title}</h2>
            <button className="sheet-close" onClick={close} aria-label={L('Fermer', 'Close')}>
              <Icon name="close" />
            </button>
          </div>
        )}
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </>,
    document.body,
  );
}

/* ---------- message éphémère ---------- */

const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<{ text: string; key: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const show = (text: string) => {
    clearTimeout(timer.current);
    setMsg({ text, key: Date.now() });
    timer.current = setTimeout(() => setMsg(null), 2600);
  };
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && (
        <div className="toast" key={msg.key} role="status">
          {msg.text}
        </div>
      )}
    </ToastCtx.Provider>
  );
}

/* ---------- liste d'opérations groupées par jour ---------- */

export const STATUS_LABEL = () => ({ ok: 'OK', warn: L('Attention', 'Careful'), over: L('Dépassé', 'Over') }) as const;

export function signed(t: Pick<Tx, 'kind' | 'amount'>): number {
  return t.kind === 'expense' ? -t.amount : t.amount;
}

export function TxRow({ t, settings, onOpen, today, showDate }: { t: Tx; settings: Settings; onOpen: (t: Tx) => void; today: string; showDate?: boolean }) {
  const cat = categoryOf(settings, t);
  const v = signed(t);
  let title = t.note || cat.name;
  let meta = t.note ? cat.name : '';
  if (t.kind === 'saving') {
    // versement : « Versement » ; retrait : sa raison (obligatoire)
    title = t.amount >= 0 ? L('Versement', 'Deposit') : `${L('Retrait', 'Withdrawal')}${t.note ? `${L(' : ', ': ')}${t.note}` : ''}`;
    meta = [cat.name, t.amount >= 0 ? t.note : ''].filter(Boolean).join(' · ');
  }
  if (showDate) meta = [meta, shortDate(t.date)].filter(Boolean).join(' · ');
  return (
    <button className="txrow" onClick={() => onOpen(t)}>
      <Ico icon={cat.icon} color={cat.color} size={48} />
      <span className="grow">
        <span className="title ellipsis" style={{ display: 'block' }}>
          {title}
        </span>
        <span className="meta">
          <Avatar person={t.person} names={settings.names} size={22} />
          <span className="ellipsis">{meta || settings.names[t.person - 1]}</span>
        </span>
      </span>
      <span className={`amt num${v > 0 ? ' plus' : ''}`}>{euros(v, { decimals: true, sign: true })}</span>
    </button>
  );
}

export function TxGroups({ txs, settings, onOpen, today, sortByAmount }: { txs: Tx[]; settings: Settings; onOpen: (t: Tx) => void; today: string; sortByAmount?: boolean }) {
  if (sortByAmount) {
    return (
      <div className="card">
        {txs.map((t) => (
          <TxRow key={t.id} t={t} settings={settings} onOpen={onOpen} today={today} showDate />
        ))}
      </div>
    );
  }
  const groups: { date: string; items: Tx[] }[] = [];
  for (const t of txs) {
    const g = groups[groups.length - 1];
    if (g && g.date === t.date) g.items.push(t);
    else groups.push({ date: t.date, items: [t] });
  }
  return (
    <div className="card">
      {groups.map((g) => {
        const tot = g.items.reduce((a, t) => a + signed(t), 0);
        return (
          <div className="daygroup" key={g.date}>
            <div className="dayhead">
              <span>{dayLabel(g.date, today)}</span>
              <span className="num">{euros(tot, { decimals: true, sign: true })}</span>
            </div>
            {g.items.map((t) => (
              <TxRow key={t.id} t={t} settings={settings} onOpen={onOpen} today={today} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

export function Empty({ emoji, children }: { emoji: string; children: ReactNode }) {
  return (
    <div className="card empty">
      <span className="e">{emoji}</span>
      {children}
    </div>
  );
}

export type AddMode = Kind;
