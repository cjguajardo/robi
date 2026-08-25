export interface PresentationSlide {
  number: number;
  title: string;
  src: string;
  redirectTo?: string;
}

const titles = [
  "Conozcamos mi profesión",
  "Qué hace un Ingeniero de Software",
  "Cómo realizo mi trabajo",
  "Qué construyo",
  "Mis herramientas de trabajo",
  "Por qué me gusta lo que hago",
  "Les presento a ROBI",
] as const;

export const PRESENTATION_SLIDES: readonly PresentationSlide[] = titles.map(
  (title, index) => {
    const number = index + 1;
    return {
      number,
      title,
      src: `/ppt/robi-profesion/slide-${String(number).padStart(2, "0")}.webp`,
      ...(number === 7 ? { redirectTo: "/display" } : {}),
    };
  },
);
