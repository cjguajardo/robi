// Shared types/helpers for the realtime layer. Kept dependency-free.
//
// The wire format is just `RealtimeEvent` (see @/types/robi) — a
// discriminated union by `type`. There's no envelope. There's no session
// id. One world, one room.

import type { RobiCommand, RealtimeEvent } from "@/types/robi";

/** Encode a command as the COMMAND event payload. */
export function commandEvent(command: RobiCommand): RealtimeEvent {
  return { type: "COMMAND", payload: command };
}