// Step picker — Ark UI SegmentGroup, two visual variants:
// - default: pill container with sliding gradient indicator
// - inline:   bare digits, no background, indicator is just a subtle highlight
//
// Anatomy note: each segment requires THREE sub-parts — ItemText (label),
// ItemControl (the actual clickable surface that wires up the selection),
// and ItemHiddenInput (the underlying form input). Without ItemControl the
// item has no click target and the picker becomes read-only (bug we hit).

import { SegmentGroup } from "@ark-ui/react/segment-group";
import { FALLBACK_CONFIG } from "@/lib/robi/commands";

interface Props {
  value: number;
  onChange: (steps: number) => void;
  max?: number;
  disabled?: boolean;
  /** Strip the pill container — used inside dark panels. */
  inline?: boolean;
}

export function StepPicker({ value, onChange, max = FALLBACK_CONFIG.maxSteps, disabled, inline }: Props) {
  const items = Array.from({ length: max }, (_, i) => i + 1);
  return (
    <SegmentGroup.Root
      className={`sg-root ${inline ? "sg-inline" : ""}`}
      value={String(value)}
      onValueChange={(d) => onChange(Number(d.value))}
      disabled={disabled}
    >
      <SegmentGroup.Indicator className="sg-indicator" />
      {items.map((n) => (
        <SegmentGroup.Item key={n} value={String(n)} className="sg-item">
          <SegmentGroup.ItemHiddenInput />
          <SegmentGroup.ItemControl className="sg-item-control">
            <SegmentGroup.ItemText className="sg-item-text">{n}</SegmentGroup.ItemText>
          </SegmentGroup.ItemControl>
        </SegmentGroup.Item>
      ))}
    </SegmentGroup.Root>
  );
}