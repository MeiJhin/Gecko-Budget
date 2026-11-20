import { useState, type CSSProperties } from 'react';
import { COLORS, ICON_GROUPS } from '../lib/defaults';
import { Sheet } from './ui';
import { L } from '../lib/i18n';

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
      title={L("Choisir l'icône", 'Choose the icon')}
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
          {L("C'est bon", 'Done')}
        </button>
      }
    >
      <div className="ip-preview">
        <div className="big" style={{ '--c': col } as CSSProperties} aria-hidden="true">
          {ic}
        </div>
        <div>
          <div className="n">{name || L('Sans nom', 'Untitled')}</div>
          <div className="muted">{L('Touchez une icône puis une couleur', 'Tap an icon, then a colour')}</div>
        </div>
      </div>
      <span className="label">{L('Couleur', 'Colour')}</span>
      <div className="swatches" role="radiogroup" aria-label={L('Couleur', 'Colour')}>
        {COLORS.map((c) => (
          <button key={c} role="radio" aria-checked={col === c} aria-label={`${L('Couleur', 'Colour')} ${c}`} className={`swatch${col === c ? ' on' : ''}`} style={{ background: c }} onClick={() => setCol(c)} />
        ))}
      </div>
      {ICON_GROUPS.map((g) => (
        <div className="ip-group" key={g.title}>
          <h4>{g.title}</h4>
          <div className="ip-grid">
            {g.icons.map((x) => (
              <button key={x} className={ic === x ? 'on' : ''} onClick={() => setIc(x)} aria-label={`${L('Icône', 'Icon')} ${x}`} aria-pressed={ic === x}>
                {x}
              </button>
            ))}
          </div>
        </div>
      ))}
    </Sheet>
  );
}
