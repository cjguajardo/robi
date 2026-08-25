import { PRESENTATION_SLIDES } from "@/lib/presentation/slides";
import { usePresentationSocket } from "./usePresentationSocket";

export function PptController() {
  const { presentation, connected, goTo } = usePresentationSocket();
  const current =
    PRESENTATION_SLIDES[presentation.currentSlide - 1] ?? PRESENTATION_SLIDES[0];
  const canGoPrevious = connected && presentation.currentSlide > 1;
  const canGoNext =
    connected && presentation.currentSlide < presentation.totalSlides;

  return (
    <main className="ppt-control">
      <header className="ppt-control-header">
        <a href="/control" className="ppt-back-link">
          ← ROBI
        </a>
        <form method="post" action="/api/control/logout">
          <button type="submit" className="ppt-logout">Salir</button>
        </form>
      </header>

      <section className="ppt-control-heading">
        <p className="ppt-control-eyebrow">Presentador</p>
        <h1>Control de presentación</h1>
        <div className="ppt-control-connection" data-connected={connected}>
          <span aria-hidden="true" />
          {connected ? "Proyector conectado" : "Conectando al proyector…"}
        </div>
      </section>

      <section className="ppt-preview-card" aria-live="polite">
        <img
          src={current.src}
          alt={`Vista previa: ${current.title}`}
          width={1600}
          height={900}
        />
        <div className="ppt-preview-meta">
          <strong>{presentation.currentSlide} de {presentation.totalSlides}</strong>
          <span>{current.title}</span>
        </div>
      </section>

      <nav className="ppt-direction-controls" aria-label="Navegación de presentación">
        <button
          type="button"
          aria-label="Diapositiva anterior"
          disabled={!canGoPrevious}
          onClick={() => goTo(presentation.currentSlide - 1)}
        >
          <span aria-hidden="true">←</span>
          Anterior
        </button>
        <button
          type="button"
          aria-label="Diapositiva siguiente"
          disabled={!canGoNext}
          onClick={() => goTo(presentation.currentSlide + 1)}
        >
          Siguiente
          <span aria-hidden="true">→</span>
        </button>
      </nav>

      <section className="ppt-slide-picker" aria-label="Ir a una diapositiva">
        {PRESENTATION_SLIDES.map((slide) => (
          <button
            key={slide.number}
            type="button"
            className="ppt-slide-jump"
            aria-label={`Ir a diapositiva ${slide.number}: ${slide.title}`}
            aria-current={
              slide.number === presentation.currentSlide ? "page" : undefined
            }
            disabled={!connected}
            onClick={() => goTo(slide.number)}
          >
            {slide.number}
          </button>
        ))}
      </section>
    </main>
  );
}
