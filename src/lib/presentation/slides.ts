export interface PresentationSlide {
  number: number;
  title: string;
  src: string;
  redirectTo?: string;
}

const titles = [
  "Conozcamos mi profesión",
  "Qué hace un ingeniero de software",
  "Cómo hago mi trabajo",
  "Qué puedo construir",
  "Mis herramientas",
  "Por qué es importante",
  "Por qué me gusta",
  "Les presento a ROBI",
  "Entrando a ROBI",
] as const;

export const PRESENTATION_SLIDES: readonly PresentationSlide[] = titles.map(
  (title, index) => {
    const number = index + 1;
    return {
      number,
      title,
      src: `/ppt/robi-profesion2/slide-${String(number).padStart(2, "0")}.webp`,
      ...(number === 9 ? { redirectTo: "/display" } : {}),
    };
  },
);
