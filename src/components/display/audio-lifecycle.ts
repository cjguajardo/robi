export type AudioLifecyclePurpose = "idle" | "unlock" | "speech";

/** Only real ROBI speech may drive the shared speech state machine. */
export function shouldRelayAudioLifecycle(
  purpose: AudioLifecyclePurpose,
): boolean {
  return purpose === "speech";
}
