import { useState, type CSSProperties } from 'react';
import { COLORS, ICON_GROUPS } from '../lib/defaults';
import { Sheet } from './ui';

export default function IconPicker({
  name,
  icon,
  color,
  onDone,
  onClose,
}: {
  name: string;
  icon: string;
  color: string;
  onDone: (icon: string, color: string) => void;
  onClose: () => void;
}) {
  const [ic, setIc] = useState(icon);
  const [col, setCol] = useState(color);
  const [done, setDone] = useState(false);
  return (
    <Sheet
      title="Choisir l'icône"
      onClose={onClose}
      z={1}
      closeSignal={done}
      footer={
        <button
          className="btn"
          onClick={() => {
            onDone(ic, col);
            setDone(true);
          }}
        >
          C'est bon
        </button>
      }
    >
      <div className="ip-preview">
        <div className="big" style={{ '--c': col } as CSSProperties} aria-hidden="true">
          {ic}
        </div>
        <div>
          <div className="n">{name || 'Sans nom'}</div>
          <div className="muted">Touchez une icône puis une couleur</div>
        </div>
      </div>
      <span className="label">Couleur</span>
      <div className="swatches" role="radiogroup" aria-label="Couleur">
        {COLORS.map((c) => (
          <button key={c} role="radio" aria-checked={col === c} aria-label={`Couleur ${c}`} className={`swatch${col === c ? ' on' : ''}`} style={{ background: c }} onClick={() => setCol(c)} />
        ))}
      </div>
      {ICON_GROUPS.map((g) => (
        <div className="ip-group" key={g.title}>
          <h4>{g.title}</h4>
          <div className="ip-grid">
            {g.icons.map((x) => (
              <button key={x} className={ic === x ? 'on' : ''} onClick={() => setIc(x)} aria-label={`Icône ${x}`} aria-pressed={ic === x}>
                {x}
              </button>
            ))}
          </div>
        </div>
      ))}
    </Sheet>
  );
}
