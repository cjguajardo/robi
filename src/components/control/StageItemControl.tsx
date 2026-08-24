import type { StageItemPlacement } from "@/types/robi";
import { spawnRipple, flashSent } from "./ripple";

interface Props {
  onAdd: (placement: StageItemPlacement) => void;
  disabled?: boolean;
}

const POSITIONS: ReadonlyArray<{
  placement: StageItemPlacement;
  label: string;
  symbol: string;
}> = [
  { placement: "LEFT", label: "Agregar objeto aleatorio a la izquierda", symbol: "←" },
  { placement: "ABOVE", label: "Agregar objeto aleatorio arriba de ROBI", symbol: "↑" },
  { placement: "RIGHT", label: "Agregar objeto aleatorio a la derecha", symbol: "→" },
];

export function StageItemControl({ onAdd, disabled }: Props) {
  return (
    <section className="stage-item-control card" aria-label="Agregar un objeto al escenario">
      <div className="stage-item-copy">
        <strong>Objeto aleatorio</strong>
        <span>Elige dónde aparece</span>
      </div>
      <div className="stage-position-actions">
        {POSITIONS.map(({ placement, label, symbol }) => (
          <button
            key={placement}
            type="button"
            className="stage-position-button"
            aria-label={label}
            title={label}
            disabled={disabled}
            onClick={(event) => {
              spawnRipple(event);
              flashSent(event.currentTarget);
              onAdd(placement);
            }}
          >
            <span aria-hidden="true">{symbol}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
