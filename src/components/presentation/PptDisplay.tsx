import { useEffect } from "react";
import {
  PRESENTATION_SLIDES,
  type PresentationSlide,
} from "@/lib/presentation/slides";
import { usePresentationSocket } from "./usePresentationSocket";

type ReplaceLocation = (destination: string) => void;

export function redirectToSlideDestination(
  slide: PresentationSlide,
  replace: ReplaceLocation = (destination) => window.location.replace(destination),
) {
  if (!slide.redirectTo) return false;

  replace(slide.redirectTo);
  return true;
}

export function PptDisplay() {
  const { presentation, connected } = usePresentationSocket();
  const slide =
    PRESENTATION_SLIDES[presentation.currentSlide - 1] ?? PRESENTATION_SLIDES[0];

  useEffect(() => {
    for (const offset of [-1, 1]) {
      const neighbor = PRESENTATION_SLIDES[presentation.currentSlide - 1 + offset];
      if (neighbor) new Image().src = neighbor.src;
    }
  }, [presentation.currentSlide]);

  useEffect(() => {
    redirectToSlideDestination(slide);
  }, [slide]);

  const enterFullscreen = () => {
    document.documentElement.requestFullscreen?.().catch(() => undefined);
  };

  return (
    <main className="ppt-display" data-connected={connected}>
      <img
        key={slide.number}
        className="ppt-slide"
        src={slide.src}
        alt={`Diapositiva ${slide.number}: ${slide.title}`}
        width={1600}
        height={900}
      />
      <div className="ppt-display-status" role="status">
        <span className="ppt-status-dot" aria-hidden="true" />
        {connected ? "Control conectado" : "Esperando control"}
      </div>
      <div className="ppt-display-counter" aria-live="polite">
        {presentation.currentSlide} / {presentation.totalSlides}
      </div>
      <button
        type="button"
        className="ppt-fullscreen"
        onClick={enterFullscreen}
      >
        Pantalla completa
      </button>
    </main>
  );
}
