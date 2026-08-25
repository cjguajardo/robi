interface FullscreenDocumentLike {
  fullscreenElement: unknown;
  documentElement: {
    requestFullscreen?: (options?: FullscreenOptions) => Promise<void>;
  };
}

/** Request fullscreen without leaking browser-policy failures to the UI. */
export async function enterDisplayFullscreen(
  documentLike: FullscreenDocumentLike,
): Promise<boolean> {
  if (documentLike.fullscreenElement) return true;

  const target = documentLike.documentElement;
  if (!target.requestFullscreen) return false;

  try {
    await target.requestFullscreen({ navigationUI: "hide" });
    return true;
  } catch {
    return false;
  }
}
