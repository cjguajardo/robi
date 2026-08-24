import type { CSSProperties } from "react";
import type { Position, StageItem as StageItemModel, StageItemKind } from "@/types/robi";
import { BLOCK_PX } from "@/lib/robi/commands";

const LABEL: Record<StageItemKind, string> = {
  STAR: "Estrella",
  BOX: "Caja",
  BALL: "Pelota",
};

interface Props {
  item: StageItemModel;
  robiPosition: Position;
  transitionMs: number;
}

export function StageItem({ item, robiPosition, transitionMs }: Props) {
  const offsetX = (item.position.x - robiPosition.x) * BLOCK_PX;
  const style = {
    "--stage-item-x": `${offsetX}px`,
    "--stage-item-transition": `${transitionMs}ms`,
  } as CSSProperties;
  const kindClass = item.kind.toLowerCase();
  const anchorClass = item.placement === "ABOVE" ? "stage-item-above" : "stage-item-side";

  return (
    <div
      className={`stage-item stage-item-${kindClass} ${anchorClass}`}
      style={style}
      role="img"
      aria-label={LABEL[item.kind]}
    >
      <ItemGraphic kind={item.kind} />
    </div>
  );
}

function ItemGraphic({ kind }: { kind: StageItemKind }) {
  if (kind === "STAR") {
    return (
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <path d="M50 5 61 36l33 1-26 20 9 33-27-19-27 19 9-33L6 37l33-1Z" />
      </svg>
    );
  }

  if (kind === "BOX") {
    return (
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <path className="box-top" d="m50 8 38 20-38 20L12 28Z" />
        <path className="box-left" d="M12 28v44l38 20V48Z" />
        <path className="box-right" d="m50 48 38-20v44L50 92Z" />
        <path className="box-tape" d="m36 15 38 20-10 6-38-20Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="43" />
      <path d="M16 31c18 4 31 18 36 38M63 10c-5 18-1 35 13 50M12 66c20-6 43-2 60 12" />
    </svg>
  );
}
