// Command panel — iOS-style.
// Pasos panel + d-pad movement grid in one row.
// Unified 3×2 quick-actions block below.
//
// Dpad semantics: arrows are kid-game controls.
// Up = jump one block forward (always 1, the picker doesn't apply).
// Left/Right = walk sideways `steps` blocks (picker applies, UI default 3).
// Down = stop. In-place rotation was removed — there's no button or
// voice command for it anymore.

import type { RobiCommand } from "@/types/robi";
import { StepPicker } from "./StepPicker";
import {
  MovementUpIcon,
  MovementLeftIcon,
  MovementRightIcon,
  MovementStopIcon,
  HandIcon,
  MusicIcon,
  StarIcon,
  JokeIcon,
  RiddleIcon,
  FactIcon,
  CheckIcon,
} from "./Icons";
import { spawnRipple, flashSent } from "./ripple";

interface Props {
  steps: number;
  onStepsChange: (n: number) => void;
  onCommand: (cmd: RobiCommand) => void;
  disabled?: boolean;
}

export function CommandPanel({ steps, onStepsChange, onCommand, disabled }: Props) {
  return (
    <div className="cmd-stack">
      <h2 className="section-title">Movimiento</h2>
      <div className="mov-row">
        <div className="card pasos-panel">
          <span className="pasos-label">Pasos</span>
          <StepPicker
            value={steps}
            onChange={onStepsChange}
            disabled={disabled}
            inline
          />
        </div>
        <div className="card dpad-panel">
          <div className="dpad">
            <Pill
              label="Saltar"
              onClick={() => onCommand({ type: "JUMP" })}
              disabled={disabled}
              icon={<MovementUpIcon size={24} className="movement-icon movement-icon-up" />}
              className="dpad-up"
              iconOnly
            />
            <Pill
              label="Caminar a la izquierda"
              onClick={() => onCommand({ type: "WALK_LEFT", steps })}
              disabled={disabled}
              icon={<MovementLeftIcon size={24} className="movement-icon movement-icon-left" />}
              className="dpad-left"
              iconOnly
            />
            <div className="dpad-center" />
            <Pill
              label="Caminar a la derecha"
              onClick={() => onCommand({ type: "WALK_RIGHT", steps })}
              disabled={disabled}
              icon={<MovementRightIcon size={24} className="movement-icon movement-icon-right" />}
              className="dpad-right"
              iconOnly
            />
            <Pill
              label="Detener"
              onClick={() => onCommand({ type: "STOP" })}
              disabled={disabled}
              icon={<MovementStopIcon size={22} className="movement-icon movement-icon-stop" />}
              className="dpad-down"
              iconOnly
            />
          </div>
        </div>
      </div>

      <section className="quick-actions card" aria-label="Acciones y contenido">
        <Pill
          label="Saludar"
          onClick={() => onCommand({ type: "GREET" })}
          disabled={disabled}
          icon={<HandIcon size={20} />}
        />
        <Pill
          label="Bailar"
          onClick={() => onCommand({ type: "DANCE" })}
          disabled={disabled}
          icon={<MusicIcon size={20} />}
        />
        <Pill
          label="Celebrar"
          onClick={() => onCommand({ type: "CELEBRATE" })}
          disabled={disabled}
          icon={<StarIcon size={20} />}
        />
        <Pill
          label="Chiste"
          onClick={() => onCommand({ type: "TELL_JOKE" })}
          disabled={disabled}
          icon={<JokeIcon size={20} />}
        />
        <Pill
          label="Adivinanza"
          onClick={() => onCommand({ type: "TELL_RIDDLE" })}
          disabled={disabled}
          icon={<RiddleIcon size={20} />}
        />
        <Pill
          label="Dato curioso"
          onClick={() => onCommand({ type: "TELL_FACT" })}
          disabled={disabled}
          icon={<FactIcon size={20} />}
        />
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Unified pill — used by d-pad, actions, and emergency              */
/* ------------------------------------------------------------------ */

function Pill({
  label,
  onClick,
  disabled,
  className = "",
  icon,
  iconOnly = false,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  icon: React.ReactNode;
  /** Hide the text label — used for icon-only buttons (dpad). */
  iconOnly?: boolean;
}) {
  const handle = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    spawnRipple(e);
    flashSent(e.currentTarget);
    onClick();
  };

  return (
    <button
      type="button"
      className={`pill ${className} ${iconOnly ? "icon-only" : ""}`}
      onClick={handle}
      disabled={disabled}
      aria-label={label}
      title={iconOnly ? label : undefined}
    >
      <span className="ic-wrap">
        {icon}
        <CheckIcon size={12} className="sent-check" />
      </span>
      {!iconOnly && <span className="lb">{label}</span>}
    </button>
  );
}
