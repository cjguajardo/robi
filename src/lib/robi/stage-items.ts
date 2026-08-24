import type {
  Position,
  RobiCommand,
  StageItem,
  StageItemKind,
  StageItemPlacement,
} from "@/types/robi";

const ITEM_KINDS: readonly StageItemKind[] = ["STAR", "BOX", "BALL"];
const MIN_SIDE_STEPS = 5;
const MAX_SIDE_STEPS = 7;

function randomIndex(length: number, random: () => number): number {
  return Math.min(length - 1, Math.floor(Math.max(0, random()) * length));
}

/**
 * Create a target relative to ROBI's current world position.
 * The RNG is injectable so the domain rule stays deterministic in tests.
 */
export function createRandomStageItem(
  placement: StageItemPlacement,
  origin: Position,
  random: () => number = Math.random,
): StageItem {
  const kind = ITEM_KINDS[randomIndex(ITEM_KINDS.length, random)] ?? "STAR";

  if (placement === "ABOVE") {
    return {
      kind,
      placement,
      position: { x: origin.x, y: origin.y + 1 },
      distanceSteps: 0,
    };
  }

  const range = MAX_SIDE_STEPS - MIN_SIDE_STEPS + 1;
  const distanceSteps = MIN_SIDE_STEPS + randomIndex(range, random);
  const direction = placement === "LEFT" ? -1 : 1;

  return {
    kind,
    placement,
    position: { x: origin.x + direction * distanceSteps, y: origin.y },
    distanceSteps,
  };
}

/**
 * Return when a movement touches an item, as a normalized 0..1 progress.
 * `null` means the movement never intersects the target.
 *
 * Lateral walks use the complete segment, not only the destination, so
 * an oversized command still collects an object ROBI visibly crosses.
 * JUMP is in-place and reaches an ABOVE target at its visual apex.
 */
export function collisionProgress(
  item: StageItem,
  from: Position,
  to: Position,
  command: RobiCommand,
): number | null {
  if (command.type === "JUMP") {
    const isDirectlyAbove =
      item.placement === "ABOVE" &&
      item.position.x === from.x &&
      item.position.y === from.y + 1;
    return isDirectlyAbove ? 0.5 : null;
  }

  if (command.type !== "WALK_LEFT" && command.type !== "WALK_RIGHT") {
    return null;
  }

  if (from.y !== to.y || item.position.y !== from.y) {
    return null;
  }

  const totalX = to.x - from.x;
  if (totalX === 0) return null;

  const progress = (item.position.x - from.x) / totalX;
  return progress >= 0 && progress <= 1 ? progress : null;
}
